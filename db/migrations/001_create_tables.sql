CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL UNIQUE
        REFERENCES public.users(id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_tenant_id_fkey'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
            ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    client_name TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_type TEXT,
    recurrence_end_date TIMESTAMPTZ,
    parent_id UUID REFERENCES public.receivables(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_type TEXT,
    recurrence_end_date TIMESTAMPTZ,
    parent_id UUID REFERENCES public.payables(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference_type TEXT,
    reference_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    receivable_id UUID NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL,
    client_name TEXT,
    email_id TEXT,
    auto BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.job_status (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    job_name TEXT NOT NULL,
    last_run TIMESTAMPTZ,
    sent_count INTEGER NOT NULL DEFAULT 0,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (tenant_id, job_name)
);

CREATE INDEX IF NOT EXISTS receivables_tenant_due_date_idx
    ON public.receivables (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS payables_tenant_due_date_idx
    ON public.payables (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS ledger_tenant_created_at_idx
    ON public.ledger_entries (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reminders_receivable_sent_at_idx
    ON public.reminders (receivable_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS users_tenant_id_idx
    ON public.users (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_initial_balance_per_tenant_idx
    ON public.ledger_entries (tenant_id)
    WHERE entry_type = 'SALDO_INICIAL';
CREATE UNIQUE INDEX IF NOT EXISTS ledger_payment_reference_idx
    ON public.ledger_entries (reference_type, reference_id)
    WHERE reference_type IN ('receivable', 'payable') AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_tenant_id UUID := gen_random_uuid();
    profile_name TEXT := COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
        split_part(NEW.email, '@', 1)
    );
BEGIN
    INSERT INTO public.tenants (id, owner_user_id, name)
    VALUES (new_tenant_id, NEW.id, 'Conta de ' || profile_name);

    INSERT INTO public.users (id, email, name, tenant_id, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        profile_name,
        new_tenant_id,
        COALESCE(NEW.created_at, now()),
        now()
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_auth_user();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status ENABLE ROW LEVEL SECURITY;
