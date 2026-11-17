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


def make_proposal(tenant_id):
    return {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "title": "Consultoria",
        "client_name": "Cliente",
        "contact_name": None,
        "issue_date": "2026-01-01",
        "valid_until": "2026-01-31",
        "amount_cents": 125000,
        "status": "RASCUNHO",
        "content": {"sections": [{"title": "Apresentação", "body": "Texto"}], "city": None},
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


def test_create_proposal_uses_authenticated_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    saved = {}

    async def insert(table, values):
        assert table == "proposals"
        saved.update(values)
        return values

    monkeypatch.setattr(server.database, "insert", insert)
    data = server.ProposalCreate(
        title="Consultoria",
        client_name="Cliente",
        issue_date=date(2026, 1, 1),
        valid_until=date(2026, 1, 31),
        amount_cents=125000,
        content={
            "sections": [{"title": "Apresentação", "body": "Texto"}],
            "provider": {
                "display_name": "Estúdio Exemplo",
                "email": "contato@example.com",
            },
            "payment_schedule": [
                {
                    "description": "Entrada",
                    "due_date": "2026-01-05",
                    "amount_cents": 50000,
                },
                {
                    "description": "Entrega",
                    "due_date": "2026-01-31",
                    "amount_cents": 75000,
                },
            ],
        },
    )

    result = asyncio.run(server.create_proposal(data, {"tenant_id": tenant_id}))

    assert saved["tenant_id"] == tenant_id
    assert saved["content"]["sections"][0]["body"] == "Texto"
    assert saved["content"]["provider"]["display_name"] == "Estúdio Exemplo"
    assert saved["content"]["payment_schedule"][0]["amount_cents"] == 50000
    assert result.content.provider.display_name == "Estúdio Exemplo"
    assert result.content.payment_schedule[1].description == "Entrega"
    assert result.status == "RASCUNHO"


def test_proposal_payment_schedule_must_match_investment_total():
    with pytest.raises(ValidationError, match="soma das parcelas"):
        server.ProposalCreate(
            title="Consultoria",
            client_name="Cliente",
            issue_date=date(2026, 1, 1),
            valid_until=date(2026, 1, 31),
            amount_cents=125001,
            content={
                "payment_schedule": [{
                    "description": "Parcela única",
                    "due_date": "2026-01-31",
                    "amount_cents": 125000,
                }],
            },
        )


def test_proposal_content_allows_financial_section_when_legacy_sections_are_at_limit():
    content = server.ProposalContent(
        sections=[
            {"title": f"Seção {index}", "body": ""}
            for index in range(31)
        ],
    )

    assert len(content.sections) == 31


def test_partial_proposal_update_validates_existing_payment_schedule(monkeypatch):
    tenant_id = str(uuid.uuid4())
    proposal = make_proposal(tenant_id)
    proposal["content"]["payment_schedule"] = [{
        "description": "Parcela única",
        "due_date": "2026-01-31",
        "amount_cents": 125000,
    }]

    async def fetch_one(_table, _filters):
        return proposal

    async def update_one(*_args, **_kwargs):
        raise AssertionError("A proposal with mismatched payments must not be saved")

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "update_one", update_one)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.update_proposal(
                proposal["id"],
                server.ProposalUpdate(amount_cents=130000),
                {"tenant_id": tenant_id},
            )
        assert error.value.status_code == 422

    asyncio.run(run())


def test_list_proposals_queries_only_authenticated_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    proposal = make_proposal(tenant_id)
    calls = []

    async def fetch_many(table, filters, limit, order_by=None, descending=False):
        calls.append((table, filters, order_by, descending))
        return [proposal]

    monkeypatch.setattr(server.database, "fetch_many", fetch_many)
    result = asyncio.run(server.list_proposals(None, {"tenant_id": tenant_id}))

    assert calls == [("proposals", {"tenant_id": tenant_id}, "updated_at", True)]
    assert result[0].tenant_id == tenant_id


def test_get_proposal_returns_not_found_outside_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())

    async def fetch_one(table, filters):
        assert table == "proposals"
        assert filters["tenant_id"] == tenant_id
        return None

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.get_proposal(str(uuid.uuid4()), {"tenant_id": tenant_id})
        assert error.value.status_code == 404

    asyncio.run(run())


def test_delete_proposal_is_scoped_to_authenticated_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    proposal_id = str(uuid.uuid4())
    calls = []

    async def delete_one(table, filters):
        calls.append((table, filters))
        return True

    monkeypatch.setattr(server.database, "delete_one", delete_one)

    result = asyncio.run(
        server.delete_proposal(proposal_id, {"tenant_id": tenant_id})
    )

    assert calls == [(
        "proposals",
        {"id": proposal_id, "tenant_id": tenant_id},
    )]
    assert result == {"message": "Proposta excluída com sucesso"}


def test_delete_proposal_returns_not_found_for_other_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    proposal_id = str(uuid.uuid4())
    calls = []

    async def delete_one(table, filters):
        calls.append((table, filters))
        return False

    monkeypatch.setattr(server.database, "delete_one", delete_one)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.delete_proposal(proposal_id, {"tenant_id": tenant_id})
        assert error.value.status_code == 404

    asyncio.run(run())
    assert calls == [(
        "proposals",
        {"id": proposal_id, "tenant_id": tenant_id},
    )]


def test_update_rejects_validity_before_existing_issue_date(monkeypatch):
    tenant_id = str(uuid.uuid4())
    proposal = make_proposal(tenant_id)

    async def fetch_one(_table, _filters):
        return proposal

    async def update_one(*_args, **_kwargs):
        raise AssertionError("An invalid proposal must not be persisted")

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "update_one", update_one)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.update_proposal(
                proposal["id"],
                server.ProposalUpdate(valid_until=date(2025, 12, 31)),
                {"tenant_id": tenant_id},
            )
        assert error.value.status_code == 422

    asyncio.run(run())


def test_update_rejects_null_required_dates():
    with pytest.raises(ValidationError):
        server.ProposalUpdate(valid_until=None)
