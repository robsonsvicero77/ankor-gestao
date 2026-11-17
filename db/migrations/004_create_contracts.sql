CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_id_id_idx
    ON public.clients (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    title TEXT NOT NULL,
    issue_date DATE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    total_amount_cents BIGINT NOT NULL DEFAULT 0
        CHECK (total_amount_cents >= 0),
    status TEXT NOT NULL DEFAULT 'RASCUNHO'
        CHECK (status IN (
            'RASCUNHO',
            'ENVIADO',
            'ASSINADO',
            'EM_EXECUCAO',
            'CONCLUIDO',
            'CANCELADO'
        )),
    client_snapshot JSONB NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contracts_client_same_tenant_fk
        FOREIGN KEY (tenant_id, client_id)
        REFERENCES public.clients (tenant_id, id)
        ON DELETE NO ACTION
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT contracts_end_after_start
        CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT contracts_title_not_blank
        CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS contracts_tenant_updated_at_idx
    ON public.contracts (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS contracts_tenant_status_updated_at_idx
    ON public.contracts (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS contracts_tenant_client_idx
    ON public.contracts (tenant_id, client_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
