# Backend production deployment

The application uses FastAPI on Vercel, Supabase Auth for accounts, and Supabase
Postgres for application data. The React frontend remains a static site on
Hostinger.

## Supabase setup

1. Create a Supabase project.
2. Run [`db/migrations/001_create_tables.sql`](../db/migrations/001_create_tables.sql)
   in the Supabase SQL Editor. It creates the application tables and provisions
   a tenant/profile automatically for each new Auth user.
3. Run [`db/migrations/002_create_proposals.sql`](../db/migrations/002_create_proposals.sql)
   in the Supabase SQL Editor to enable proposal storage before using the page.
4. Run [`db/migrations/003_create_clients.sql`](../db/migrations/003_create_clients.sql)
   in the Supabase SQL Editor to enable tenant-scoped client storage.
5. Run [`db/migrations/004_create_contracts.sql`](../db/migrations/004_create_contracts.sql)
   after migration 003 to enable tenant-scoped contracts linked to saved clients.
6. Configure the project's Auth site URL as the Hostinger site URL. Add local
   development URLs to the allowed redirect URLs if needed.
7. Copy the project URL and publishable/anon key from the Supabase API settings.
   The frontend key is public by design; never expose the Postgres password.

## Vercel API

Deploy `backend/` as a separate Vercel project with `backend/` as its Root
Directory. Set these environment variables for every Vercel environment used:

- `APP_ENV=production`
- `SUPABASE_URL`: the project URL
- `SUPABASE_ANON_KEY`: the project's publishable/anon key; the API uses it only
  to ask Supabase Auth to validate the caller's access token
- `DATABASE_URL`: the Supabase **transaction pooler** connection string (port
  6543), with SSL enabled. It must use the database password, not an Auth key.
- `CORS_ORIGINS`: comma-separated exact HTTPS origins for the Hostinger site
- `RESEND_API_KEY` and `SENDER_EMAIL`: required only for email features

The API uses the database connection directly for SQL and enforces tenant scope
in every data query. Do not put `DATABASE_URL` in the frontend or commit it.
The async Postgres pool disables prepared statement caching for compatibility
with Supabase's transaction pooler.

## Hostinger frontend

Before building, set these frontend build variables:

- `REACT_APP_BACKEND_URL`: the deployed Vercel API origin
- `REACT_APP_SUPABASE_URL`: the Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY`: the publishable/anon key

Run the frontend production build and upload the contents of `frontend/build`
to `public_html`. The frontend `.htaccess` routes React Router paths to
`index.html`.

For local development, copy `backend/.env.example` to `backend/.env` and
`frontend/.env.example` to `frontend/.env`, fill in the project's values, and
keep `APP_ENV=development`. Start the API from `backend/` with
`uvicorn server:app --reload`; the React app defaults to the local API outside
production.

The optional `backend_test.py` integration suite requires a separate test-only
confirmed Supabase account and `SUPABASE_TEST_EMAIL` / `SUPABASE_TEST_PASSWORD`,
in addition to `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The suite writes
financial records, so do not point it at a tenant containing real data.
