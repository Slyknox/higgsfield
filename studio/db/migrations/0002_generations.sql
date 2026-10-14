-- Generations owned by users, the reference uploads they make, and webhook
-- de-duplication. RLS on with no policies, like every app table.

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references users(id) on delete cascade,
  -- Client-side project id until projects move to Postgres.
  project_id text,
  surface text not null check (surface in ('image', 'video', 'audio')),
  model_id text not null,
  model_path text not null,
  prompt text not null default '',
  settings jsonb not null default '{}',
  media jsonb not null default '[]',
  status text not null check (status in
    ('pending_submit', 'queued', 'in_progress', 'completed', 'failed', 'nsfw', 'canceled')),
  hf_request_id text unique,
  -- [{ "kind": "video", "url": "...", "key": "u/1/<id>/0.mp4" }]
  outputs jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index generations_user_created_idx on generations (user_id, created_at desc);
create index generations_in_flight_idx on generations (updated_at)
  where status in ('pending_submit', 'queued', 'in_progress');

create table uploads (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references users(id) on delete cascade,
  public_url text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);
create index uploads_user_created_idx on uploads (user_id, created_at desc);

-- One row per (request, terminal status) Higgsfield told us about.
create table hf_webhook_events (
  request_id text not null,
  status text not null,
  received_at timestamptz not null default now(),
  primary key (request_id, status)
);

alter table generations enable row level security;
alter table uploads enable row level security;
alter table hf_webhook_events enable row level security;
