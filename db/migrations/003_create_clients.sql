CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL CHECK (person_type IN ('PF', 'PJ')),
    name TEXT NOT NULL,
    trade_name TEXT,
    document TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    contact_name TEXT,
    postal_code TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    district TEXT,
    city TEXT,
    state TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT clients_document_not_blank CHECK (length(trim(document)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_document_idx
    ON public.clients (tenant_id, document);
CREATE INDEX IF NOT EXISTS clients_tenant_updated_at_idx
    ON public.clients (tenant_id, updated_at DESC);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
