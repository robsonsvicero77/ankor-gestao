-- Persistent settings for profiles, provider details, client reminders and alerts.
-- Apply after migrations 001 through 004.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS avatar_path TEXT;

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS provider_display_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_legal_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_document TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_representative_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_email TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_phone TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS provider_configured BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS alert_preferences JSONB NOT NULL DEFAULT
        '{"client_email_reminders": false, "in_app_alerts": true, "owner_email_alerts": true}'::jsonb;

ALTER TABLE public.receivables
    ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'receivables_tenant_client_fkey'
          AND conrelid = 'public.receivables'::regclass
    ) THEN
        ALTER TABLE public.receivables
            ADD CONSTRAINT receivables_tenant_client_fkey
            FOREIGN KEY (tenant_id, client_id)
            REFERENCES public.clients (tenant_id, id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS receivables_tenant_client_idx
    ON public.receivables (tenant_id, client_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    FALSE,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Users can read their own avatar'
    ) THEN
        CREATE POLICY "Users can read their own avatar"
            ON storage.objects FOR SELECT TO authenticated
            USING (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Users can upload their own avatar'
    ) THEN
        CREATE POLICY "Users can upload their own avatar"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Users can update their own avatar'
    ) THEN
        CREATE POLICY "Users can update their own avatar"
            ON storage.objects FOR UPDATE TO authenticated
            USING (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar')
            WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Users can delete their own avatar'
    ) THEN
        CREATE POLICY "Users can delete their own avatar"
            ON storage.objects FOR DELETE TO authenticated
            USING (bucket_id = 'avatars' AND name = auth.uid()::text || '/avatar');
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_user_email_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        UPDATE public.users
        SET email = NEW.email,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_email_from_auth ON auth.users;
CREATE TRIGGER sync_user_email_from_auth
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_email_from_auth();
