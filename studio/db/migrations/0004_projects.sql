-- Projects owned by users (previously browser-local). Ids are UUIDs the
-- browser may choose, so a project can be used before the insert returns.
-- RLS on with no policies, like every app table.

create table projects (
  id uuid primary key,
  user_id integer not null references users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_updated_idx on projects (user_id, updated_at desc);

-- Generations keep their text project_id: rows made before this migration
-- carry browser ids. New ones are checked against projects on submit.
create index generations_user_project_idx on generations (user_id, project_id)
  where project_id is not null;

alter table projects enable row level security;
