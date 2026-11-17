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
        },
    )

    result = asyncio.run(server.create_proposal(data, {"tenant_id": tenant_id}))

    assert saved["tenant_id"] == tenant_id
    assert saved["content"]["sections"][0]["body"] == "Texto"
    assert saved["content"]["provider"]["display_name"] == "Estúdio Exemplo"
    assert result.content.provider.display_name == "Estúdio Exemplo"
    assert result.status == "RASCUNHO"


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
