import asyncio
import os
import uuid
from datetime import date

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

os.environ["APP_ENV"] = "test"
os.environ["CORS_ORIGINS"] = ""

from backend import server


def make_contract_input(client_id, **overrides):
    values = {
        "client_id": client_id,
        "title": "Contrato de identidade visual",
        "issue_date": date(2026, 1, 1),
        "start_date": date(2026, 1, 5),
        "end_date": date(2026, 2, 5),
        "total_amount_cents": 125000,
        "content": {
            "service_types": ["Identidade visual"],
            "object_description": "Criação de identidade visual.",
            "scope": "Pesquisa, conceito e desenvolvimento da identidade.",
            "provider": {"display_name": "Prestador"},
            "payment_schedule": [
                {
                    "description": "Entrada",
                    "due_date": "2026-01-05",
                    "amount_cents": 50000,
                },
                {
                    "description": "Entrega",
                    "due_date": "2026-02-05",
                    "amount_cents": 75000,
                },
            ],
            "clauses": [{"title": "Do objeto", "body": "Termos editáveis."}],
        },
    }
    values.update(overrides)
    return server.ContractInput(**values)


def make_client(tenant_id, client_id):
    return {
        "id": client_id,
        "tenant_id": tenant_id,
        "person_type": "PJ",
        "name": "Empresa Exemplo Ltda.",
        "trade_name": "Empresa Exemplo",
        "document": "11222333000181",
        "email": "contato@example.com",
        "phone": "11999999999",
        "contact_name": "Ana Silva",
        "postal_code": "01310100",
        "street": "Rua Exemplo",
        "number": "10",
        "complement": None,
        "district": "Centro",
        "city": "São Paulo",
        "state": "SP",
    }


def test_contract_input_requires_payment_schedule_to_match_total():
    client_id = uuid.uuid4()
    with pytest.raises(ValidationError, match="soma das parcelas"):
        make_contract_input(
            client_id,
            total_amount_cents=125001,
        )


def test_contract_input_rejects_end_date_before_start_date():
    with pytest.raises(ValidationError, match="data final"):
        make_contract_input(
            uuid.uuid4(),
            end_date=date(2026, 1, 4),
        )


def test_create_contract_scopes_client_and_saves_snapshot(monkeypatch):
    tenant_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())
    client = make_client(tenant_id, client_id)
    saved = {}
    calls = []

    async def fetch_one(table, filters):
        calls.append((table, filters))
        assert table == "clients"
        assert filters == {"id": client_id, "tenant_id": tenant_id}
        return client

    async def insert(table, values):
        assert table == "contracts"
        saved.update(values)
        return values

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "insert", insert)

    result = asyncio.run(
        server.create_contract(
            make_contract_input(client_id),
            {"tenant_id": tenant_id},
        )
    )

    assert calls == [("clients", {"id": client_id, "tenant_id": tenant_id})]
    assert saved["tenant_id"] == tenant_id
    assert saved["client_id"] == client_id
    assert saved["client_snapshot"]["name"] == client["name"]
    assert saved["content"]["provider"]["display_name"] == "Prestador"
    assert result.client_snapshot.name == client["name"]


def test_create_contract_rejects_client_outside_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())

    async def fetch_one(table, filters):
        assert table == "clients"
        assert filters == {"id": client_id, "tenant_id": tenant_id}
        return None

    async def insert(*_args, **_kwargs):
        raise AssertionError("A contract with an inaccessible client must not be saved")

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "insert", insert)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.create_contract(
                make_contract_input(client_id),
                {"tenant_id": tenant_id},
            )
        assert error.value.status_code == 404

    asyncio.run(run())


def test_update_contract_preserves_client_snapshot(monkeypatch):
    tenant_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())
    contract_id = str(uuid.uuid4())
    client = make_client(tenant_id, client_id)
    existing = {
        "id": contract_id,
        "tenant_id": tenant_id,
        "client_id": client_id,
        "title": "Contrato anterior",
        "issue_date": "2026-01-01",
        "start_date": "2026-01-05",
        "end_date": "2026-02-05",
        "total_amount_cents": 125000,
        "status": "RASCUNHO",
        "client_snapshot": {
            **client,
            "name": "Nome congelado no contrato",
        },
        "content": make_contract_input(client_id).model_dump(mode="json")["content"],
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    update_values = {}

    async def fetch_one(table, filters):
        if table == "contracts":
            assert filters == {"id": contract_id, "tenant_id": tenant_id}
            return existing
        assert table == "clients"
        assert filters == {"id": client_id, "tenant_id": tenant_id}
        return client

    async def update_one(table, filters, values):
        assert table == "contracts"
        assert filters == {"id": contract_id, "tenant_id": tenant_id}
        update_values.update(values)
        return {**existing, **values}

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "update_one", update_one)

    result = asyncio.run(
        server.update_contract(
            contract_id,
            make_contract_input(client_id, title="Contrato atualizado"),
            {"tenant_id": tenant_id},
        )
    )

    assert update_values["client_snapshot"]["name"] == "Nome congelado no contrato"
    assert result.client_snapshot.name == "Nome congelado no contrato"
    assert result.title == "Contrato atualizado"
