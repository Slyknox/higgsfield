-- Auth.js (@auth/pg-adapter 1.11) tables plus app columns, rate limits and the
-- local-only email outbox. Every table has row level security on and no
-- policies: Supabase's public API roles (anon, authenticated) can read
-- nothing. The app connects as the database owner, which bypasses RLS.

create table users (
  id serial primary key,
  name varchar(255),
  email varchar(255) unique,
  "emailVerified" timestamptz,
  image text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table accounts (
  id serial primary key,
  "userId" integer not null references users(id) on delete cascade,
  type varchar(255) not null,
  provider varchar(255) not null,
  "providerAccountId" varchar(255) not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  id_token text,
  scope text,
  session_state text,
  token_type text,
  unique (provider, "providerAccountId")
);

create table sessions (
  id serial primary key,
  "userId" integer not null references users(id) on delete cascade,
  expires timestamptz not null,
  "sessionToken" varchar(255) not null unique
);
create index sessions_user_idx on sessions ("userId");

create table verification_token (
  identifier text not null,
  expires timestamptz not null,
  token text not null,
  primary key (identifier, token)
);

-- Fixed-window counters, e.g. key 'magic-link:email:a@b.c'.
create table rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);

-- Magic links written here instead of emailed when EMAIL_TRANSPORT=outbox.
-- The app refuses that transport unless AUTH_URL is localhost.
create table email_outbox (
  id bigserial primary key,
  recipient text not null,
  subject text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
alter table accounts enable row level security;
alter table sessions enable row level security;
alter table verification_token enable row level security;
alter table rate_limits enable row level security;
alter table email_outbox enable row level security;
