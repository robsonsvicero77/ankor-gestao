-- Link receivables generated from signed contract payment schedules.
-- Apply after migrations 001 through 005.

CREATE UNIQUE INDEX IF NOT EXISTS contracts_tenant_id_id_idx
    ON public.contracts (tenant_id, id);

ALTER TABLE public.receivables
    ADD COLUMN IF NOT EXISTS contract_id UUID,
    ADD COLUMN IF NOT EXISTS contract_payment_index INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'receivables_contract_same_tenant_fkey'
          AND conrelid = 'public.receivables'::regclass
    ) THEN
        ALTER TABLE public.receivables
            ADD CONSTRAINT receivables_contract_same_tenant_fkey
            FOREIGN KEY (tenant_id, contract_id)
            REFERENCES public.contracts (tenant_id, id)
            ON DELETE NO ACTION
            DEFERRABLE INITIALLY DEFERRED;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'receivables_contract_payment_fields_check'
          AND conrelid = 'public.receivables'::regclass
    ) THEN
        ALTER TABLE public.receivables
            ADD CONSTRAINT receivables_contract_payment_fields_check
            CHECK (
                (contract_id IS NULL AND contract_payment_index IS NULL)
                OR (
                    contract_id IS NOT NULL
                    AND contract_payment_index IS NOT NULL
                    AND contract_payment_index >= 0
                )
            );
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS receivables_contract_payment_unique_idx
    ON public.receivables (tenant_id, contract_id, contract_payment_index);
