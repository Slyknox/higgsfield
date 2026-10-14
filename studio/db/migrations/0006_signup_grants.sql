-- Addresses that have received sign-up credits, as SHA-256 of the lower-case
-- email. Kept when the account is deleted, so deleting and signing up again
-- doesn't grant them twice. No other data about the person is kept.

create table signup_grants (
  email_hash text primary key,
  granted_at timestamptz not null default now()
);

alter table signup_grants enable row level security;
