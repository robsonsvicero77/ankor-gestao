CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    contact_name TEXT,
    issue_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
    status TEXT NOT NULL DEFAULT 'RASCUNHO'
        CHECK (status IN (
            'RASCUNHO',
            'ENVIADA',
            'EM_NEGOCIACAO',
            'APROVADA',
            'RECUSADA',
            'EXPIRADA',
            'CANCELADA'
        )),
    content JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT proposals_validity_after_issue
        CHECK (valid_until >= issue_date)
);

CREATE INDEX IF NOT EXISTS proposals_tenant_updated_at_idx
    ON public.proposals (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS proposals_tenant_status_updated_at_idx
    ON public.proposals (tenant_id, status, updated_at DESC);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
