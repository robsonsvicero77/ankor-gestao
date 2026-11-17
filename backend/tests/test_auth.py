import asyncio
import os
import uuid

import httpx
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

os.environ["APP_ENV"] = "test"
os.environ["CORS_ORIGINS"] = ""

from backend import server


def test_current_user_validates_supabase_token_and_loads_profile(monkeypatch):
    user_id = str(uuid.uuid4())
    profile = {
        "id": user_id,
        "tenant_id": str(uuid.uuid4()),
        "role": "user",
    }

    def auth_response(request):
        assert request.url.path == "/auth/v1/user"
        assert request.headers["apikey"] == "test-publishable-key"
        assert request.headers["authorization"] == "Bearer valid-token"
        return httpx.Response(200, json={"id": user_id})

    async def fetch_one(table, filters):
        assert table == "users"
        assert filters == {"id": user_id}
        return profile

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(auth_response))
        monkeypatch.setattr(server, "auth_http_client", client)
        monkeypatch.setattr(server, "SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr(server, "SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")
        monkeypatch.setattr(server.database, "fetch_one", fetch_one)
        try:
            result = await server.get_current_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid-token")
            )
        finally:
            await client.aclose()
        return result

    assert asyncio.run(run()) == {
        "user_id": user_id,
        "tenant_id": profile["tenant_id"],
        "role": "user",
    }


def test_current_user_rejects_expired_supabase_token(monkeypatch):
    def auth_response(_request):
        return httpx.Response(401, json={"message": "invalid token"})

    async def run():
        client = httpx.AsyncClient(transport=httpx.MockTransport(auth_response))
        monkeypatch.setattr(server, "auth_http_client", client)
        monkeypatch.setattr(server, "SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr(server, "SUPABASE_PUBLISHABLE_KEY", "test-publishable-key")
        try:
            with pytest.raises(HTTPException) as error:
                await server.get_current_user(
                    HTTPAuthorizationCredentials(scheme="Bearer", credentials="expired-token")
                )
        finally:
            await client.aclose()
        assert error.value.status_code == 401

    asyncio.run(run())
