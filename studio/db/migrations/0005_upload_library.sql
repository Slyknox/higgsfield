-- The reference library comes from the server. A row is written when the
-- upload is prepared; it joins the library only once the browser confirms the
-- file arrived.

alter table uploads add column name text check (char_length(name) <= 200);
alter table uploads add column confirmed_at timestamptz;
create index uploads_user_confirmed_idx on uploads (user_id, created_at desc)
  where confirmed_at is not null;
