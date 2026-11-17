import asyncio
import os
import uuid

import pytest
from fastapi import HTTPException

os.environ["APP_ENV"] = "test"
os.environ["CORS_ORIGINS"] = ""

from backend import server


def test_get_settings_returns_tenant_preferences_and_balance(monkeypatch):
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    calls = []

    async def fetch_one(table, filters):
        calls.append((table, filters))
        if table == "users":
            return {"id": user_id, "tenant_id": tenant_id, "name": "Ana", "email": "ana@example.com"}
        if table == "tenants":
            return {
                "id": tenant_id,
                "timezone": "America/Sao_Paulo",
                "provider_display_name": "Estúdio",
                "provider_configured": True,
                "alert_preferences": {
                    "client_email_reminders": True,
                    "in_app_alerts": False,
                },
            }
        return {"direction": "DEBIT", "amount_cents": 25000}

    async def has_other_entries(received_tenant_id):
        assert received_tenant_id == tenant_id
        return False

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "has_non_initial_ledger_entries", has_other_entries)

    result = asyncio.run(server.get_settings({"user_id": user_id, "tenant_id": tenant_id}))

    assert result["name"] == "Ana"
    assert result["provider"]["display_name"] == "Estúdio"
    assert result["provider_configured"] is True
    assert result["alerts"] == {
        "client_email_reminders": True,
        "in_app_alerts": False,
        "owner_email_alerts": True,
    }
    assert result["initial_balance_cents"] == -25000
    assert result["initial_balance_editable"] is True
    assert calls == [
        ("users", {"id": user_id, "tenant_id": tenant_id}),
        ("tenants", {"id": tenant_id}),
        ("ledger_entries", {"tenant_id": tenant_id, "entry_type": "SALDO_INICIAL"}),
    ]


def test_update_settings_persists_profile_and_tenant_scoped_preferences(monkeypatch):
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    calls = []

    async def update_one(table, filters, values):
        calls.append((table, filters, values))
        return {"id": filters["id"], **values}

    monkeypatch.setattr(server.database, "update_one", update_one)
    data = server.SettingsUpdate(
        name="  Ana Silva  ",
        timezone="America/Manaus",
        provider={
            "display_name": "  Estúdio Ana ",
            "email": "ana@example.com",
        },
        alerts={
            "client_email_reminders": True,
            "in_app_alerts": False,
            "owner_email_alerts": True,
        },
    )

    result = asyncio.run(
        server.update_settings(data, {"user_id": user_id, "tenant_id": tenant_id})
    )

    assert result == {"message": "Configurações salvas"}
    assert calls[0][0:2] == ("users", {"id": user_id, "tenant_id": tenant_id})
    assert calls[0][2]["name"] == "Ana Silva"
    assert calls[1][0:2] == ("tenants", {"id": tenant_id})
    assert calls[1][2]["provider_display_name"] == "Estúdio Ana"
    assert calls[1][2]["provider_configured"] is True
    assert calls[1][2]["alert_preferences"]["in_app_alerts"] is False


def test_update_settings_rejects_invalid_timezone_before_writing(monkeypatch):
    async def update_one(*_args, **_kwargs):
        raise AssertionError("Invalid settings must not be written")

    monkeypatch.setattr(server.database, "update_one", update_one)
    data = server.SettingsUpdate(
        name="Ana",
        timezone="Mars/Olympus",
        provider={},
        alerts={},
    )

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.update_settings(
                data,
                {"user_id": str(uuid.uuid4()), "tenant_id": str(uuid.uuid4())},
            )
        assert error.value.status_code == 422

    asyncio.run(run())


def test_avatar_path_can_only_reference_the_authenticated_user(monkeypatch):
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    async def update_one(table, filters, values):
        assert table == "users"
        assert filters == {"id": user_id, "tenant_id": tenant_id}
        assert values["avatar_path"] == f"{user_id}/avatar"
        return {"avatar_path": values["avatar_path"]}

    monkeypatch.setattr(server.database, "update_one", update_one)

    result = asyncio.run(
        server.update_avatar(
            server.AvatarUpdate(avatar_path=f"{user_id}/avatar"),
            {"user_id": user_id, "tenant_id": tenant_id},
        )
    )
    assert result["avatar_path"] == f"{user_id}/avatar"

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.update_avatar(
                server.AvatarUpdate(avatar_path=f"{uuid.uuid4()}/avatar"),
                {"user_id": user_id, "tenant_id": tenant_id},
            )
        assert error.value.status_code == 422

    asyncio.run(run())


def test_opening_balance_update_returns_conflict_after_other_ledger_entries(monkeypatch):
    async def update_balance(*_args):
        return None

    monkeypatch.setattr(
        server.database, "update_initial_balance_if_ledger_empty", update_balance
    )

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.update_opening_balance(
                server.OpeningBalanceUpdate(amount_cents=50000),
                {"tenant_id": str(uuid.uuid4())},
            )
        assert error.value.status_code == 409

    asyncio.run(run())


def test_due_alert_cron_requires_secret(monkeypatch):
    monkeypatch.setattr(server, "CRON_SECRET", "expected-secret")

    async def run():
        with pytest.raises(HTTPException) as error:
            await server.run_due_alerts_cron("Bearer wrong-secret")
        assert error.value.status_code == 401

    asyncio.run(run())


def test_upcoming_alerts_honor_in_app_preference(monkeypatch):
    tenant_id = str(uuid.uuid4())

    async def fetch_one(table, filters):
        assert table == "tenants"
        assert filters == {"id": tenant_id}
        return {
            "id": tenant_id,
            "alert_preferences": {"in_app_alerts": False},
        }

    async def fetch_many(*_args, **_kwargs):
        raise AssertionError("Disabled alerts must not query financial entries")

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "fetch_many", fetch_many)

    result = asyncio.run(server.get_upcoming_alerts({"tenant_id": tenant_id}))

    assert result == {"enabled": False, "items": []}


def test_create_receivable_links_only_a_client_from_the_current_tenant(monkeypatch):
    tenant_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())
    inserted = {}

    async def fetch_one(table, filters):
        assert table == "clients"
        assert filters == {"id": client_id, "tenant_id": tenant_id}
        return {
            "id": client_id,
            "tenant_id": tenant_id,
            "name": "Empresa Ltda.",
            "trade_name": "Empresa",
        }

    async def insert(table, values):
        assert table == "receivables"
        inserted.update(values)
        return values

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "insert", insert)
    data = server.ReceivableCreate(
        description="Projeto",
        client_name="Nome livre",
        client_id=client_id,
        amount_cents=50000,
        due_date="2026-03-01T00:00:00+00:00",
    )

    result = asyncio.run(server.create_receivable(data, {"tenant_id": tenant_id}))

    assert inserted["client_id"] == client_id
    assert inserted["client_name"] == "Empresa"
    assert result.client_id == client_id
    assert result.client_name == "Empresa"


def test_manual_reminder_sends_to_linked_client_email(monkeypatch):
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    receivable_id = str(uuid.uuid4())
    client_id = str(uuid.uuid4())
    inserted = []

    async def fetch_one(table, filters):
        if table == "receivables":
            assert filters == {"id": receivable_id, "tenant_id": tenant_id}
            return {
                "id": receivable_id,
                "tenant_id": tenant_id,
                "client_id": client_id,
                "client_name": "Empresa",
                "description": "Projeto",
                "amount_cents": 10000,
                "due_date": "2026-01-20T00:00:00+00:00",
                "paid_at": None,
            }
        if table == "clients":
            assert filters == {"id": client_id, "tenant_id": tenant_id}
            return {
                "name": "Empresa Ltda.",
                "trade_name": "Empresa",
                "email": "financeiro@example.com",
            }
        assert table == "users"
        return {"name": "Prestadora", "email": "conta@example.com"}

    async def insert(table, values):
        assert table == "reminders"
        inserted.append(values)
        return values

    async def send_email(_send, params):
        assert params["to"] == ["financeiro@example.com"]
        return {"id": "email-123"}

    monkeypatch.setattr(server.database, "fetch_one", fetch_one)
    monkeypatch.setattr(server.database, "insert", insert)
    monkeypatch.setattr(server.asyncio, "to_thread", send_email)
    monkeypatch.setattr(server, "RESEND_API_KEY", "configured")

    response = asyncio.run(
        server.send_payment_reminder(
            server.EmailReminderRequest(receivable_id=receivable_id),
            {"tenant_id": tenant_id, "user_id": user_id},
        )
    )

    assert response.success is True
    assert response.email_id == "email-123"
    assert inserted[0]["client_name"] == "Empresa"
