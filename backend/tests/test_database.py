import asyncio
import uuid
from datetime import date, datetime, timezone

import pytest

from backend.database import PostgresDatabase, _serialize_record, _where_clause


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
