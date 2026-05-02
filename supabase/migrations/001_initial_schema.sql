-- notebooks table
create table if not exists notebooks (
  id              text primary key,
  youtube_url     text not null,
  video_title     text not null,
  channel_name    text not null,
  duration_seconds integer not null default 0,
  thumbnail_url   text not null default '',
  source_language text not null default 'en',
  target_language text not null default 'zh',
  summary         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- subtitles table
create table if not exists subtitles (
  id              text primary key,
  notebook_id     text not null references notebooks(id) on delete cascade,
  sequence        integer not null,
  start_time      real not null,
  end_time        real not null,
  original_text   text not null,
  translated_text text,
  user_note       text,
  created_at      timestamptz not null default now()
);

create index if not exists subtitles_notebook_id_idx on subtitles(notebook_id);

-- auto-update updated_at on notebooks
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notebooks_updated_at
  before update on notebooks
  for each row execute procedure update_updated_at();
