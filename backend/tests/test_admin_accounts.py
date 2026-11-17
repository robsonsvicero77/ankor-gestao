import asyncio
import os
import uuid

import httpx
import pytest
from fastapi import HTTPException

os.environ["APP_ENV"] = "test"
os.environ["CORS_ORIGINS"] = ""

from backend import server


def test_admin_account_list_reads_every_auth_page_and_uses_profile_name(monkeypatch):
    profile_id = str(uuid.uuid4())
    auth_users = [
        {
            "id": str(uuid.uuid4()),
            "email": f"user-{index}@example.com",
            "created_at": f"2026-01-{(index % 28) + 1:02d}T12:00:00+00:00",
            "user_metadata": {"name": f"Auth name {index}"},
        }
        for index in range(100)
    ]
    auth_users[0] = {
        "id": profile_id,
        "email": "current@example.com",
        "created_at": "2026-01-01T12:00:00+00:00",
        "user_metadata": {"name": "Nome Auth"},
    }
    requests = []

    def auth_response(request):
        requests.append(request)
        assert request.headers["apikey"] == "server-only-key"
        assert "authorization" not in request.headers
        page = int(request.url.params["page"])
        if page == 1:
            return httpx.Response(200, json={"users": auth_users})
        if page == 2:
            return httpx.Response(200, json={
                "users": [{
                    "id": str(uuid.uuid4()),
                    "email": "last@example.com",
                    "created_at": "2026-02-01T12:00:00+00:00",
                }],
            })
        raise AssertionError(f"Unexpected page: {page}")

    async def fetch_profiles():
        return [{
            "id": profile_id,
            "name": "Nome atualizado",
            "email": "old@example.com",
            "created_at": "2026-01-01T12:00:00+00:00",
            "role": "user",
        }]

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(auth_response))
        monkeypatch.setattr(server, "auth_http_client", client)
        monkeypatch.setattr(server, "SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr(server, "SUPABASE_SECRET_KEY", "server-only-key")
        monkeypatch.setattr(server.database, "fetch_admin_user_profiles", fetch_profiles)
        try:
            result = await server.list_admin_accounts({"role": "admin"})
        finally:
            await client.aclose()
        return result

    result = asyncio.run(run())

    assert len(result["accounts"]) == 101
    assert [request.url.params["page"] for request in requests] == ["1", "2"]
    profile = next(account for account in result["accounts"] if account["id"] == profile_id)
    assert profile == {
        "id": profile_id,
        "name": "Nome atualizado",
        "email": "current@example.com",
        "created_at": "2026-01-01T12:00:00+00:00",
        "role": "user",
    }


def test_account_delete_rejects_self_and_administrator_accounts(monkeypatch):
    admin_id = str(uuid.uuid4())
    target_admin_id = str(uuid.uuid4())

    async def fetch_one(_table, filters):
        assert filters == {"id": target_admin_id}
        return {"id": target_admin_id, "role": "admin"}

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)

    async def run():
        admin = {"id": admin_id, "role": "admin"}
        with pytest.raises(HTTPException) as self_error:
            await server.delete_admin_account(uuid.UUID(admin_id), admin)
        assert self_error.value.status_code == 409

        with pytest.raises(HTTPException) as target_error:
            await server.delete_admin_account(uuid.UUID(target_admin_id), admin)
        assert target_error.value.status_code == 409

    asyncio.run(run())


def test_account_delete_uses_supabase_admin_api_for_regular_accounts(monkeypatch):
    admin_id = str(uuid.uuid4())
    target_id = str(uuid.uuid4())

    async def fetch_one(table, filters):
        assert table == "users"
        assert filters == {"id": target_id}
        return {"id": target_id, "role": "user"}

    def auth_response(request):
        assert request.method == "DELETE"
        assert request.url.path == f"/auth/v1/admin/users/{target_id}"
        assert request.headers["apikey"] == "server-only-key"
        assert "authorization" not in request.headers
        return httpx.Response(204)

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(auth_response))
        monkeypatch.setattr(server, "auth_http_client", client)
        monkeypatch.setattr(server, "SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr(server, "SUPABASE_SECRET_KEY", "server-only-key")
        monkeypatch.setattr(server.database, "fetch_one", fetch_one)
        try:
            result = await server.delete_admin_account(
                uuid.UUID(target_id),
                {"id": admin_id, "role": "admin"},
            )
        finally:
            await client.aclose()
        return result

    assert asyncio.run(run()) == {
        "message": "Conta e dados associados excluídos permanentemente",
    }


def test_admin_accounts_reject_non_admins(monkeypatch):
    async def fetch_one(_table, _filters):
        return {"role": "user"}

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.require_role("admin")({"user_id": str(uuid.uuid4())})
        assert error.value.status_code == 403

    asyncio.run(run())
