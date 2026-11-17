import asyncio
import uuid
from datetime import date, datetime, timezone

import pytest

from backend.database import (
    PostgresDatabase,
    _build_contract_receivable_records,
    _normalize_value,
    _serialize_record,
    _where_clause,
)


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _traceback):
        return False


class FakeAcquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, _exc_type, _exc, _traceback):
        return False


class FakeContractConnection:
    def __init__(self):
        self.contracts = {}
        self.receivables = {}

    def transaction(self):
        return FakeTransaction()

    async def fetchrow(self, query, *parameters):
        if query.startswith('INSERT INTO "contracts"'):
            row = self._insert_values(query, parameters)
            self.contracts[row["id"]] = row
            return row
        if query.startswith('SELECT * FROM "contracts"'):
            contract = self.contracts.get(parameters[0])
            return dict(contract) if contract else None
        if query.startswith('UPDATE "contracts"'):
            assignments = query.split(" SET ", 1)[1].split(" WHERE ", 1)[0]
            row = self.contracts[parameters[len(assignments.split(", "))]]
            for assignment in assignments.split(", "):
                column, placeholder = assignment.split(" = ")
                row[column.strip('"')] = parameters[int(placeholder[1:]) - 1]
            return row
        if query.startswith('INSERT INTO "receivables"'):
            row = self._insert_values(query, parameters)
            key = (
                row["tenant_id"],
                row["contract_id"],
                row["contract_payment_index"],
            )
            if key in self.receivables:
                return None
            self.receivables[key] = row
            return row
        raise AssertionError(f"Unexpected query: {query}")

    @staticmethod
    def _insert_values(query, parameters):
        table_name = query.split('INSERT INTO "', 1)[1].split('"', 1)[0]
        columns_text = query.split(f'INSERT INTO "{table_name}" (', 1)[1]
        columns_text = columns_text.split(") VALUES", 1)[0]
        columns = [column.strip('"') for column in columns_text.split(", ")]
        return dict(zip(columns, parameters))


class FakeContractPool:
    def __init__(self):
        self.connection = FakeContractConnection()

    def acquire(self):
        return FakeAcquire(self.connection)


def make_contract_record(status="ASSINADO"):
    return {
        "id": str(uuid.uuid4()),
        "tenant_id": str(uuid.uuid4()),
        "client_id": str(uuid.uuid4()),
        "title": "Identidade visual",
        "issue_date": "2026-01-01",
        "start_date": "2026-01-05",
        "end_date": None,
        "total_amount_cents": 125000,
        "status": status,
        "client_snapshot": {"name": "Cliente Exemplo", "trade_name": "Cliente"},
        "content": {
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
        },
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


def test_where_clause_converts_uuid_timestamps_and_null_filters():
    tenant_id = uuid.uuid4()
    start = "2026-01-01T00:00:00Z"
    end = "2026-01-31T23:59:59+00:00"

    clause, values = _where_clause(
        "receivables",
        {
            "tenant_id": str(tenant_id),
            "paid_at": None,
            "due_date": {"$gte": start, "$lte": end},
        },
    )

    assert clause == (
        ' WHERE "tenant_id" = $1 AND "paid_at" IS NULL '
        'AND "due_date" >= $2 AND "due_date" <= $3'
    )
    assert values == [
        tenant_id,
        datetime(2026, 1, 1, tzinfo=timezone.utc),
        datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc),
    ]


def test_where_clause_rejects_untrusted_table_and_column_names():
    with pytest.raises(ValueError, match="Unknown database table"):
        _where_clause("users; DROP TABLE users", {"id": str(uuid.uuid4())})

    with pytest.raises(ValueError, match="Unknown column"):
        _where_clause("users", {"email; DROP TABLE users": "user@example.com"})


def test_serialize_record_returns_json_compatible_values():
    user_id = uuid.uuid4()
    created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    result = _serialize_record({
        "id": user_id,
        "created_at": created_at,
        "results": '[{"status":"sent"}]',
    })

    assert result == {
        "id": str(user_id),
        "created_at": "2026-01-01T00:00:00+00:00",
        "results": [{"status": "sent"}],
    }


def test_proposals_support_date_and_json_fields():
    issue_date = date(2026, 1, 1)

    assert _where_clause("proposals", {"issue_date": "2026-01-01"}) == (
        ' WHERE "issue_date" = $1',
        [issue_date],
    )
    assert _serialize_record({
        "issue_date": issue_date,
        "content": '{"sections":[]}',
    }) == {
        "issue_date": "2026-01-01",
        "content": {"sections": []},
    }


def test_clients_support_tenant_scoped_document_queries():
    tenant_id = uuid.uuid4()

    assert _where_clause("clients", {"tenant_id": str(tenant_id)}) == (
        ' WHERE "tenant_id" = $1',
        [tenant_id],
    )


def test_contracts_support_tenant_client_dates_and_snapshots():
    tenant_id = uuid.uuid4()
    client_id = uuid.uuid4()

    clause, values = _where_clause(
        "contracts",
        {"tenant_id": str(tenant_id), "client_id": str(client_id)},
    )

    assert clause == ' WHERE "tenant_id" = $1 AND "client_id" = $2'
    assert values == [tenant_id, client_id]
    assert _normalize_value("start_date", "2026-01-05") == date(2026, 1, 5)
    assert _serialize_record({
        "client_snapshot": '{"name":"Empresa Exemplo"}',
    }) == {
        "client_snapshot": {"name": "Empresa Exemplo"},
    }


def test_database_reads_and_mutations_require_filters():
    database = PostgresDatabase()

    async def run():
        with pytest.raises(ValueError, match="query requires filters"):
            await database.fetch_one("users", {})
        with pytest.raises(ValueError, match="query requires filters"):
            await database.fetch_many("users", {}, 10)
        with pytest.raises(ValueError, match="update operation requires filters"):
            await database.update_one("users", {}, {"role": "admin"})
        with pytest.raises(ValueError, match="delete operation requires filters"):
            await database.delete_one("users", {})

    asyncio.run(run())


def test_contract_receivable_rows_keep_client_and_installment_details():
    contract = make_contract_record()

    rows = _build_contract_receivable_records(
        contract,
        "2026-01-01T00:00:00+00:00",
    )

    assert len(rows) == 2
    assert rows[0]["description"] == "Identidade visual - Entrada"
    assert rows[0]["client_name"] == "Cliente"
    assert rows[0]["client_id"] == contract["client_id"]
    assert rows[0]["contract_id"] == contract["id"]
    assert rows[0]["contract_payment_index"] == 0
    assert rows[0]["amount_cents"] == 50000
    assert rows[1]["contract_payment_index"] == 1
    assert rows[1]["due_date"] == "2026-02-05T00:00:00+00:00"


def test_contract_creation_generates_receivables_atomically():
    database = PostgresDatabase()
    database.pool = FakeContractPool()

    contract, created_count = asyncio.run(
        database.create_contract_record(make_contract_record())
    )

    assert contract["status"] == "ASSINADO"
    assert created_count == 2
    assert len(database.pool.connection.receivables) == 2


def test_contract_signature_transition_generates_once_and_preserves_receivables():
    database = PostgresDatabase()
    database.pool = FakeContractPool()
    values = make_contract_record(status="RASCUNHO")
    contract_id = values["id"]
    tenant_id = values["tenant_id"]

    asyncio.run(database.create_contract_record(values))
    signed, created_count = asyncio.run(
        database.update_contract_record(
            contract_id,
            tenant_id,
            {
                "status": "ASSINADO",
                "updated_at": "2026-01-02T00:00:00+00:00",
            },
        )
    )
    assert signed["status"] == "ASSINADO"
    assert created_count == 2

    changed_schedule = {
        **signed["content"],
        "payment_schedule": [
            *signed["content"]["payment_schedule"],
            {
                "description": "Parcela adicional",
                "due_date": "2026-03-05",
                "amount_cents": 0,
            },
        ],
    }
    updated, created_count = asyncio.run(
        database.update_contract_record(
            contract_id,
            tenant_id,
            {
                "status": "ASSINADO",
                "content": changed_schedule,
                "updated_at": "2026-01-03T00:00:00+00:00",
            },
        )
    )

    assert updated["status"] == "ASSINADO"
    assert created_count == 0
    assert len(database.pool.connection.receivables) == 2
