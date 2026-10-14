-- Prepaid credits. One balance row per user and an append-only ledger that
-- explains every change to it. 1 credit = $0.01 of retail price.
-- RLS on with no policies, like every app table.

create table credit_balances (
  user_id integer primary key references users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table credit_ledger (
  id bigserial primary key,
  user_id integer not null references users(id) on delete cascade,
  -- Positive adds credits, negative spends them.
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('signup', 'debit', 'refund', 'admin', 'purchase')),
  -- Kept when the generation is deleted, so the history still adds up.
  generation_id uuid,
  note text,
  -- The admin who made an 'admin' entry.
  actor_id integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created_idx on credit_ledger (user_id, created_at desc);
-- At most one debit and one refund per generation, so retries can't double either.
create unique index credit_ledger_generation_reason_idx on credit_ledger (generation_id, reason)
  where generation_id is not null;

-- What the generation cost when it was submitted; 0 while billing is off.
alter table generations add column cost integer not null default 0 check (cost >= 0);

alter table credit_balances enable row level security;
alter table credit_ledger enable row level security;
