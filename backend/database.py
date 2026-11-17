import json
import os
import uuid
from datetime import date, datetime, timezone
from typing import Any, Mapping, Optional

import asyncpg


TABLE_COLUMNS = {
    "users": {
        "id", "email", "name", "tenant_id", "created_at", "updated_at",
        "last_login_at", "role", "avatar_path",
    },
    "tenants": {
        "id", "owner_user_id", "name", "timezone", "created_at", "updated_at",
        "provider_display_name", "provider_legal_name", "provider_document",
        "provider_representative_name", "provider_email", "provider_phone",
        "provider_address", "provider_configured", "alert_preferences",
    },
    "receivables": {
        "id", "tenant_id", "description", "client_name", "client_id", "amount_cents",
        "due_date", "paid_at", "is_recurring", "recurrence_type",
        "recurrence_end_date", "parent_id", "created_at", "updated_at",
    },
    "payables": {
        "id", "tenant_id", "description", "category", "amount_cents",
        "due_date", "paid_at", "is_recurring", "recurrence_type",
        "recurrence_end_date", "parent_id", "created_at", "updated_at",
    },
    "proposals": {
        "id", "tenant_id", "title", "client_name", "contact_name",
        "issue_date", "valid_until", "amount_cents", "status", "content",
        "created_at", "updated_at",
    },
    "clients": {
        "id", "tenant_id", "person_type", "name", "trade_name", "document",
        "email", "phone", "contact_name", "postal_code", "street", "number",
        "complement", "district", "city", "state", "notes", "created_at",
        "updated_at",
    },
    "contracts": {
        "id", "tenant_id", "client_id", "title", "issue_date", "start_date",
        "end_date", "total_amount_cents", "status", "client_snapshot",
        "content", "created_at", "updated_at",
    },
    "ledger_entries": {
        "id", "tenant_id", "entry_type", "direction", "amount_cents",
        "occurred_at", "reference_type", "reference_id", "note", "created_at",
    },
    "reminders": {
        "id", "tenant_id", "receivable_id", "sent_at", "status",
        "client_name", "email_id", "auto",
    },
    "job_status": {
        "tenant_id", "job_name", "last_run", "sent_count", "results",
    },
}

UUID_COLUMNS = {
    "id", "tenant_id", "owner_user_id", "parent_id", "reference_id",
    "receivable_id", "client_id",
}
DATE_COLUMNS = {"issue_date", "valid_until", "start_date", "end_date"}
TIMESTAMP_COLUMNS = {
    "created_at", "updated_at", "last_login_at", "due_date", "paid_at",
    "recurrence_end_date", "occurred_at", "sent_at", "last_run",
}
JSON_COLUMNS = {"results", "content", "client_snapshot", "alert_preferences"}
FILTER_OPERATORS = {"$gte": ">=", "$lte": "<=", "$gt": ">", "$lt": "<"}


def _validate_table(table: str) -> None:
    if table not in TABLE_COLUMNS:
        raise ValueError(f"Unknown database table: {table}")


def _validate_column(table: str, column: str) -> None:
    _validate_table(table)
    if column not in TABLE_COLUMNS[table]:
        raise ValueError(f"Unknown column {column!r} for table {table!r}")


def _normalize_value(column: str, value: Any) -> Any:
    if value is None:
        return None
    if column in UUID_COLUMNS:
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
    if column in DATE_COLUMNS and isinstance(value, str):
        return date.fromisoformat(value)
    if column in TIMESTAMP_COLUMNS and isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    if column in JSON_COLUMNS and not isinstance(value, str):
        return json.dumps(value)
    return value


def _serialize_record(record: Optional[Mapping[str, Any]]) -> Optional[dict]:
    if record is None:
        return None
    result = dict(record)
    for column, value in result.items():
        if isinstance(value, (datetime, date)):
            result[column] = value.isoformat()
        elif column in JSON_COLUMNS and isinstance(value, str):
            result[column] = json.loads(value)
        elif isinstance(value, uuid.UUID):
            result[column] = str(value)
    return result


def _where_clause(
    table: str,
    filters: Mapping[str, Any],
    first_parameter: int = 1,
) -> tuple[str, list[Any]]:
    conditions = []
    values = []

    for column, condition in filters.items():
        _validate_column(table, column)
        if isinstance(condition, dict):
            for operator, value in condition.items():
                sql_operator = FILTER_OPERATORS.get(operator)
                if not sql_operator:
                    raise ValueError(f"Unsupported filter operator: {operator}")
                values.append(_normalize_value(column, value))
                conditions.append(f'"{column}" {sql_operator} ${first_parameter + len(values) - 1}')
        elif condition is None:
            conditions.append(f'"{column}" IS NULL')
        else:
            values.append(_normalize_value(column, condition))
            conditions.append(f'"{column}" = ${first_parameter + len(values) - 1}')

    return (" WHERE " + " AND ".join(conditions) if conditions else ""), values


class PostgresDatabase:
    def __init__(self) -> None:
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        database_url = os.environ.get("DATABASE_URL", "").strip()
        if not database_url:
            raise RuntimeError("DATABASE_URL must be configured")
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                database_url,
                min_size=1,
                max_size=5,
                command_timeout=30,
                statement_cache_size=0,
                max_cached_statement_lifetime=0,
            )

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    def _require_pool(self) -> asyncpg.Pool:
        if self.pool is None:
            raise RuntimeError("Database connection has not been initialized")
        return self.pool

    async def check(self) -> None:
        await self._require_pool().fetchval("SELECT 1")

    async def fetch_one(self, table: str, filters: Mapping[str, Any]) -> Optional[dict]:
        _validate_table(table)
        if not filters:
            raise ValueError("A query requires filters")
        where, values = _where_clause(table, filters)
        record = await self._require_pool().fetchrow(
            f'SELECT * FROM "{table}"{where} LIMIT 1', *values
        )
        return _serialize_record(record)

    async def fetch_many(
        self,
        table: str,
        filters: Mapping[str, Any],
        limit: int,
        order_by: Optional[str] = None,
        descending: bool = False,
    ) -> list[dict]:
        _validate_table(table)
        if not filters:
            raise ValueError("A query requires filters")
        where, values = _where_clause(table, filters)
        order_clause = ""
        if order_by:
            _validate_column(table, order_by)
            order_clause = f' ORDER BY "{order_by}" {"DESC" if descending else "ASC"}'
        values.append(limit)
        records = await self._require_pool().fetch(
            f'SELECT * FROM "{table}"{where}{order_clause} LIMIT ${len(values)}',
            *values,
        )
        return [_serialize_record(record) for record in records]

    async def fetch_all_tenants(self, limit: int = 1000) -> list[dict]:
        records = await self._require_pool().fetch(
            'SELECT * FROM "tenants" ORDER BY "created_at" LIMIT $1',
            limit,
        )
        return [_serialize_record(record) for record in records]

    async def insert(self, table: str, values: Mapping[str, Any]) -> dict:
        _validate_table(table)
        columns = list(values)
        if not columns:
            raise ValueError("Cannot insert an empty record")
        for column in columns:
            _validate_column(table, column)
        placeholders = ", ".join(f"${index}" for index in range(1, len(columns) + 1))
        column_sql = ", ".join(f'"{column}"' for column in columns)
        parameters = [_normalize_value(column, values[column]) for column in columns]
        record = await self._require_pool().fetchrow(
            f'INSERT INTO "{table}" ({column_sql}) VALUES ({placeholders}) RETURNING *',
            *parameters,
        )
        return _serialize_record(record)

    async def update_one(
        self,
        table: str,
        filters: Mapping[str, Any],
        values: Mapping[str, Any],
    ) -> Optional[dict]:
        _validate_table(table)
        if not filters:
            raise ValueError("An update operation requires filters")
        if not values:
            return await self.fetch_one(table, filters)
        columns = list(values)
        for column in columns:
            _validate_column(table, column)
        set_clause = ", ".join(
            f'"{column}" = ${index}' for index, column in enumerate(columns, 1)
        )
        where, filter_values = _where_clause(table, filters, len(columns) + 1)
        parameters = [_normalize_value(column, values[column]) for column in columns]
        parameters.extend(filter_values)
        record = await self._require_pool().fetchrow(
            f'UPDATE "{table}" SET {set_clause}{where} RETURNING *', *parameters
        )
        return _serialize_record(record)

    async def delete_one(self, table: str, filters: Mapping[str, Any]) -> bool:
        _validate_table(table)
        if not filters:
            raise ValueError("A delete operation requires filters")
        where, values = _where_clause(table, filters)
        record = await self._require_pool().fetchrow(
            f'DELETE FROM "{table}"{where} RETURNING 1', *values
        )
        return record is not None

    async def upsert_job_status(self, values: Mapping[str, Any]) -> None:
        columns = list(values)
        for column in columns:
            _validate_column("job_status", column)
        insert_columns = ", ".join(f'"{column}"' for column in columns)
        placeholders = ", ".join(f"${index}" for index in range(1, len(columns) + 1))
        updates = ", ".join(
            f'"{column}" = EXCLUDED."{column}"'
            for column in columns if column not in {"tenant_id", "job_name"}
        )
        parameters = [
            _normalize_value(column, values[column]) for column in columns
        ]
        await self._require_pool().execute(
            f'INSERT INTO "job_status" ({insert_columns}) VALUES ({placeholders}) '
            f'ON CONFLICT ("tenant_id", "job_name") DO UPDATE SET {updates}',
            *parameters,
        )

    async def has_non_initial_ledger_entries(self, tenant_id: str) -> bool:
        return await self._require_pool().fetchval(
            'SELECT EXISTS (SELECT 1 FROM "ledger_entries" '
            'WHERE tenant_id = $1 AND entry_type <> $2)',
            _normalize_value("tenant_id", tenant_id),
            "SALDO_INICIAL",
        )

    async def update_initial_balance_if_ledger_empty(
        self,
        tenant_id: str,
        amount_cents: int,
        note: Optional[str],
    ) -> Optional[dict]:
        pool = self._require_pool()
        tenant_uuid = _normalize_value("tenant_id", tenant_id)
        direction = "CREDIT" if amount_cents >= 0 else "DEBIT"
        absolute_amount = abs(amount_cents)

        async with pool.acquire() as connection:
            async with connection.transaction():
                await connection.execute(
                    'LOCK TABLE "ledger_entries" IN SHARE ROW EXCLUSIVE MODE'
                )
                has_other_entries = await connection.fetchval(
                    'SELECT EXISTS (SELECT 1 FROM "ledger_entries" '
                    'WHERE tenant_id = $1 AND entry_type <> $2)',
                    tenant_uuid,
                    "SALDO_INICIAL",
                )
                if has_other_entries:
                    return None

                existing = await connection.fetchrow(
                    'SELECT id FROM "ledger_entries" '
                    'WHERE tenant_id = $1 AND entry_type = $2 LIMIT 1',
                    tenant_uuid,
                    "SALDO_INICIAL",
                )
                if existing:
                    record = await connection.fetchrow(
                        'UPDATE "ledger_entries" '
                        'SET direction = $1, amount_cents = $2, note = $3 '
                        'WHERE id = $4 AND tenant_id = $5 RETURNING *',
                        direction,
                        absolute_amount,
                        note,
                        existing["id"],
                        tenant_uuid,
                    )
                else:
                    now = datetime.now(timezone.utc)
                    record = await connection.fetchrow(
                        'INSERT INTO "ledger_entries" '
                        '(id, tenant_id, entry_type, direction, amount_cents, '
                        'occurred_at, note, created_at) '
                        'VALUES ($1, $2, $3, $4, $5, $6, $7, $6) RETURNING *',
                        uuid.uuid4(),
                        tenant_uuid,
                        "SALDO_INICIAL",
                        direction,
                        absolute_amount,
                        now,
                        note,
                    )

        return _serialize_record(record)

    async def mark_paid(
        self,
        table: str,
        record_id: str,
        tenant_id: str,
        paid_at: str,
        ledger_entry: Mapping[str, Any],
    ) -> Optional[dict]:
        if table not in {"receivables", "payables"}:
            raise ValueError("Only receivables and payables can be marked paid")
        pool = self._require_pool()
        async with pool.acquire() as connection:
            async with connection.transaction():
                record = await connection.fetchrow(
                    f'UPDATE "{table}" SET paid_at = $1, updated_at = $1 '
                    'WHERE id = $2 AND tenant_id = $3 AND paid_at IS NULL RETURNING *',
                    _normalize_value("paid_at", paid_at),
                    _normalize_value("id", record_id),
                    _normalize_value("tenant_id", tenant_id),
                )
                if record is None:
                    return None

                columns = list(ledger_entry)
                for column in columns:
                    _validate_column("ledger_entries", column)
                placeholders = ", ".join(
                    f"${index}" for index in range(1, len(columns) + 1)
                )
                column_sql = ", ".join(f'"{column}"' for column in columns)
                parameters = [
                    _normalize_value(column, ledger_entry[column])
                    for column in columns
                ]
                await connection.execute(
                    f'INSERT INTO "ledger_entries" ({column_sql}) '
                    f'VALUES ({placeholders})',
                    *parameters,
                )
        return _serialize_record(record)


database = PostgresDatabase()
