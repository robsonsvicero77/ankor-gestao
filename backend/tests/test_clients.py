import asyncio
import os
import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

os.environ["APP_ENV"] = "test"
os.environ["CORS_ORIGINS"] = ""

from backend import server


def test_client_input_normalizes_and_validates_brazilian_documents():
    individual = server.ClientInput(
        person_type="PF",
        name="  Ana da Silva ",
        document="529.982.247-25",
        postal_code="01310-100",
    )
    company = server.ClientInput(
        person_type="PJ",
        name="Empresa Exemplo",
        document="11.222.333/0001-81",
    )
    alphanumeric_company = server.ClientInput(
        person_type="PJ",
        name="Empresa Alfanumérica",
        document="12.ABC.345/01DE-35",
    )

    assert individual.name == "Ana da Silva"
    assert individual.document == "52998224725"
    assert individual.postal_code == "01310100"
    assert company.document == "11222333000181"
    assert alphanumeric_company.document == "12ABC34501DE35"


def test_client_input_rejects_invalid_document_for_person_type():
    with pytest.raises(ValidationError, match="CPF válido"):
        server.ClientInput(
            person_type="PF",
            name="Ana da Silva",
            document="11.222.333/0001-81",
        )


def test_create_client_uses_authenticated_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    saved = {}

    async def insert(table, values):
        assert table == "clients"
        saved.update(values)
        return {
            **values,
            "created_at": "2026-01-01T00:00:00+00:00",
            "updated_at": "2026-01-01T00:00:00+00:00",
        }

    monkeypatch.setattr(server.database, "insert", insert)
    data = server.ClientInput(
        person_type="PF",
        name="Ana da Silva",
        document="529.982.247-25",
    )

    result = asyncio.run(server.create_client(data, {"tenant_id": tenant_id}))

    assert saved["tenant_id"] == tenant_id
    assert saved["document"] == "52998224725"
    assert result.person_type == "PF"


def test_create_client_reports_duplicate_document(monkeypatch):
    async def insert(_table, _values):
        raise server.asyncpg.UniqueViolationError("duplicate document")

    monkeypatch.setattr(server.database, "insert", insert)
    data = server.ClientInput(
        person_type="PF",
        name="Ana da Silva",
        document="529.982.247-25",
    )

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.create_client(data, {"tenant_id": str(uuid.uuid4())})
        assert error.value.status_code == 409

    asyncio.run(run())


def test_list_clients_queries_only_authenticated_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    calls = []

    async def fetch_many(table, filters, limit, order_by=None, descending=False):
        calls.append((table, filters, order_by, descending))
        return []

    monkeypatch.setattr(server.database, "fetch_many", fetch_many)

    asyncio.run(server.list_clients({"tenant_id": tenant_id}))

    assert calls == [("clients", {"tenant_id": tenant_id}, "updated_at", True)]


def test_get_client_returns_not_found_outside_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())

    async def fetch_one(table, filters):
        assert table == "clients"
        assert filters["tenant_id"] == tenant_id
        return None

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.get_client(str(uuid.uuid4()), {"tenant_id": tenant_id})
        assert error.value.status_code == 404

    asyncio.run(run())


def test_update_client_is_scoped_to_authenticated_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())
    saved = {}

    async def update_one(table, filters, values):
        assert table == "clients"
        assert filters == {"id": client_id, "tenant_id": tenant_id}
        saved.update(values)
        return {
            "id": client_id,
            "tenant_id": tenant_id,
            **values,
            "created_at": "2026-01-01T00:00:00+00:00",
        }

    monkeypatch.setattr(server.database, "update_one", update_one)
    data = server.ClientInput(
        person_type="PJ",
        name="Empresa Exemplo",
        document="11.222.333/0001-81",
        trade_name="Nome Fantasia",
    )

    result = asyncio.run(
        server.update_client(client_id, data, {"tenant_id": tenant_id})
    )

    assert saved["trade_name"] == "Nome Fantasia"
    assert result.tenant_id == tenant_id
