# Setup: local development and production accounts

## Local development

You need Node 22, pnpm 10 and a Postgres 16 database (Docker works:
`docker run -d -p 54329:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=studio_dev postgres:16`).

```bash
cd studio
pnpm install
cp .env.example .env.local      # then set AUTH_SECRET: npx auth secret
pnpm db:migrate                 # applies db/migrations/*.sql to DATABASE_URL
pnpm dev
```

With `EMAIL_TRANSPORT=outbox` no email is sent. The sign-in link is written to
the `email_outbox` table and announced in the server log:

```bash
psql "$DATABASE_URL" -c "select url from email_outbox order by id desc limit 1"
```

The outbox only works when `AUTH_URL` is a localhost URL; the server refuses
to start sign-in otherwise.

## Tests

```bash
pnpm test                                        # unit tests; DB tests skip
TEST_DATABASE_URL=postgres://... pnpm test       # plus Postgres tests (wipes that DB's public schema)
pnpm build && E2E_DATABASE_URL=postgres://... pnpm test:e2e   # browser tests (wipes it too)
```

Point the test URLs at a throwaway database, never at Supabase production.

## Supabase (database)

1. Create a project. Pick the region closest to your Vercel region.
2. **Project settings → Database → Connection string → URI**, using the
   **transaction pooler** (port 6543). Append `?sslmode=require`.
3. Run the migrations once from your machine:
   `DATABASE_URL='postgres://...:6543/postgres?sslmode=require' pnpm db:migrate`
4. Every app table has row level security on and no policies, so Supabase's
   public API (anon and authenticated keys) can read nothing. The app connects
   with the database password, which bypasses RLS. Don't add policies or
   expose these tables through the Supabase client.

The app doesn't use Supabase Auth or the Supabase JS client. Auth.js owns
sign-in; Supabase is only the Postgres host.

## Resend (sign-in email)

1. Add and verify your sending domain (DNS records Resend shows you).
2. Create an API key with "Sending access" only.
3. Set `EMAIL_TRANSPORT=resend`, `AUTH_RESEND_KEY`, and
   `EMAIL_FROM="<Brand> <login@your-domain>"`.

## Vercel (hosting)

Set these in **Project → Settings → Environment Variables** (Production and
Preview):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler URI with `?sslmode=require` |
| `AUTH_SECRET` | `npx auth secret` (a different one per environment) |
| `AUTH_URL` | Your production URL, e.g. `https://your-domain.com` |
| `EMAIL_TRANSPORT` | `resend` |
| `AUTH_RESEND_KEY` | From Resend |
| `EMAIL_FROM` | `Brand <login@your-domain.com>` |
| `HF_API_BASE_URL` | `https://api.higgsfield.ai` |

Generation (Phase 3):

| Variable | Value |
|---|---|
| `HF_API_KEY` | The complete key from open.higgsfield.ai/api-keys |
| `HF_WEBHOOK_BASE_URL` | Your production URL, e.g. `https://your-domain.com` |
| `HF_WEBHOOK_SECRET` | 32+ random characters (`openssl rand -hex 32`) |
| `CRON_SECRET` | 16+ random characters; Vercel Cron sends it automatically |
| `STORAGE_DRIVER` | `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | From Cloudflare (below) |

`vercel.json` runs `/api/cron/reconcile` every minute. Per-minute crons need
a Vercel Pro plan; on Hobby the cron runs once a day. Results still arrive
through the webhook and the status route, but runs whose webhook is lost wait
longer to be finished or failed.

Credits:

| Variable | Value |
|---|---|
| `BILLING_ENABLED` | `true` to charge credits for generations; `false` (default) makes them free |
| `CREDIT_MARKUP` | Retail price ÷ Higgsfield list price, default `2` |
| `SIGNUP_CREDITS` | Credits a new account starts with, default `0` |

Until Stripe is connected, credits only come from `SIGNUP_CREDITS` and admin
adjustments. With billing off, anyone who signs in generates on your
Higgsfield balance, so keep it off only while the site is private.

Stripe keys come with Phase 5.

## Admins

Sign in once with the account, then from `studio/` with `DATABASE_URL` set:

```bash
pnpm admin:role you@your-domain.com          # make an admin
pnpm admin:role you@your-domain.com user     # take it away
```

The change applies on the next page load. `/admin` returns 404 to everyone
else.

## Cloudflare R2 (media storage)

1. **R2 → Create bucket** (e.g. `studio-media`).
2. **Settings → Public access**: connect a custom domain such as
   `media.your-domain.com` (recommended; cacheable). The `r2.dev` URL works
   for testing but is rate-limited. That URL is `R2_PUBLIC_BASE_URL`.
3. **R2 → Manage API tokens → Create token** with *Object Read & Write*
   on that bucket only. Copy the Access Key ID and Secret into
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`; your account id is
   `R2_ACCOUNT_ID`.
4. Object keys look like `u/<userId>/<generationId>/0.mp4`. They are
   unguessable but public: anyone with a link can view that file.

## Higgsfield

1. Create a key at open.higgsfield.ai/api-keys and set `HF_API_KEY`.
2. Turn on balance alerts there. An empty balance fails every user's
   generation at once.
3. With `HF_WEBHOOK_BASE_URL` set, each submit carries
   `?hf_webhook=<your URL>/api/webhooks/higgsfield?gid=…&t=<HMAC>`. A request
   without a valid token is rejected, and even a valid one only triggers a
   status re-fetch.
