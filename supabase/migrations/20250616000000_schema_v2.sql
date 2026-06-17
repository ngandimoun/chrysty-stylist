-- Schema v2: wardrobes, uploaded_images, outfit_look_items, mem0 stubs
-- Backward-compatible: keeps legacy columns until app fully migrated

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users (profile mirror for future Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspaces extensions
-- ---------------------------------------------------------------------------
alter table workspaces add column if not exists is_default boolean not null default true;
alter table workspaces add column if not exists settings jsonb not null default '{}';
alter table workspaces add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- wardrobes
-- ---------------------------------------------------------------------------
create table if not exists wardrobes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null default 'Everyday',
  slug text not null default 'everyday',
  is_default boolean not null default true,
  item_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wardrobes_workspace_id_idx on wardrobes(workspace_id);
create unique index if not exists wardrobes_workspace_default_unique
  on wardrobes(workspace_id) where is_default = true;

-- ---------------------------------------------------------------------------
-- uploaded_images
-- ---------------------------------------------------------------------------
create table if not exists uploaded_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  mime_type text not null default 'image/jpeg',
  byte_size bigint,
  width int,
  height int,
  content_hash text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed', 'deleted')),
  source text not null default 'gallery' check (source in ('camera', 'gallery', 'generated')),
  vision jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists uploaded_images_workspace_id_idx on uploaded_images(workspace_id);
create index if not exists uploaded_images_status_idx on uploaded_images(status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- wardrobe_items extensions
-- ---------------------------------------------------------------------------
alter table wardrobe_items add column if not exists wardrobe_id uuid references wardrobes(id) on delete cascade;
alter table wardrobe_items add column if not exists user_id uuid references users(id) on delete set null;
alter table wardrobe_items add column if not exists image_id uuid references uploaded_images(id) on delete restrict;
alter table wardrobe_items add column if not exists updated_at timestamptz not null default now();

create index if not exists wardrobe_items_wardrobe_id_idx on wardrobe_items(wardrobe_id);
create index if not exists wardrobe_items_image_id_idx on wardrobe_items(image_id);

-- ---------------------------------------------------------------------------
-- conversations extensions
-- ---------------------------------------------------------------------------
alter table conversations add column if not exists user_id uuid references users(id) on delete set null;
alter table conversations add column if not exists title text;
alter table conversations add column if not exists status text not null default 'active';
alter table conversations add column if not exists last_message_at timestamptz;

-- ---------------------------------------------------------------------------
-- messages extensions
-- ---------------------------------------------------------------------------
alter table messages add column if not exists workspace_id uuid references workspaces(id) on delete cascade;
alter table messages add column if not exists token_count int;

create index if not exists messages_workspace_created_idx
  on messages(workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- outfit_generations extensions
-- ---------------------------------------------------------------------------
alter table outfit_generations add column if not exists user_id uuid references users(id) on delete set null;
alter table outfit_generations add column if not exists conversation_id uuid references conversations(id) on delete set null;
alter table outfit_generations add column if not exists message_id uuid references messages(id) on delete set null;
alter table outfit_generations add column if not exists wardrobe_id uuid references wardrobes(id) on delete set null;
alter table outfit_generations add column if not exists user_prompt text;
alter table outfit_generations add column if not exists intent text;
alter table outfit_generations add column if not exists status text not null default 'complete';
alter table outfit_generations add column if not exists model_config jsonb not null default '{}';

create index if not exists outfit_generations_workspace_created_idx
  on outfit_generations(workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- outfit_looks extensions
-- ---------------------------------------------------------------------------
alter table outfit_looks add column if not exists image_id uuid references uploaded_images(id) on delete restrict;
alter table outfit_looks add column if not exists worn_at timestamptz;

-- ---------------------------------------------------------------------------
-- outfit_look_items (junction)
-- ---------------------------------------------------------------------------
create table if not exists outfit_look_items (
  look_id uuid not null references outfit_looks(id) on delete cascade,
  wardrobe_item_id uuid not null references wardrobe_items(id) on delete cascade,
  sort_order smallint not null default 0,
  primary key (look_id, wardrobe_item_id)
);

create index if not exists outfit_look_items_item_idx on outfit_look_items(wardrobe_item_id);

-- ---------------------------------------------------------------------------
-- preference_signals extension
-- ---------------------------------------------------------------------------
alter table preference_signals add column if not exists source_look_id uuid references outfit_looks(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Mem0 stubs (schema only — no SDK in v1)
-- ---------------------------------------------------------------------------
create table if not exists mem0_sync (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  mem0_user_id text not null,
  mem0_agent_id text,
  last_synced_at timestamptz,
  sync_status text not null default 'ok' check (sync_status in ('ok', 'error', 'disabled')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists mem0_memory_refs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  mem0_memory_id text not null,
  category text,
  content_preview text,
  source_type text check (source_type in ('feedback', 'chat', 'summarize')),
  source_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mem0_memory_refs_mem0_id_unique on mem0_memory_refs(mem0_memory_id);
create index if not exists mem0_memory_refs_workspace_idx on mem0_memory_refs(workspace_id, is_active);

-- ---------------------------------------------------------------------------
-- Backfill: default wardrobe per workspace
-- ---------------------------------------------------------------------------
insert into wardrobes (workspace_id, name, slug, is_default)
select w.id, 'Everyday', 'everyday', true
from workspaces w
where not exists (
  select 1 from wardrobes wr where wr.workspace_id = w.id
);

-- Backfill: wardrobe_id on wardrobe_items
update wardrobe_items wi
set wardrobe_id = wr.id
from wardrobes wr
where wr.workspace_id = wi.workspace_id
  and wr.is_default = true
  and wi.wardrobe_id is null;

-- Backfill: uploaded_images from legacy storage_path on wardrobe_items
insert into uploaded_images (
  id, workspace_id, storage_path, thumb_path, status, source, vision, created_at
)
select
  gen_random_uuid(),
  wi.workspace_id,
  wi.storage_path,
  wi.thumb_path,
  case when wi.status = 'confirmed' then 'ready' else 'pending' end,
  'gallery',
  coalesce(wi.metadata, '{}'),
  wi.created_at
from wardrobe_items wi
where wi.storage_path is not null
  and wi.image_id is null
  and not exists (
    select 1 from uploaded_images ui
    where ui.workspace_id = wi.workspace_id
      and ui.storage_path = wi.storage_path
  );

-- Link wardrobe_items to uploaded_images
update wardrobe_items wi
set image_id = ui.id
from uploaded_images ui
where ui.workspace_id = wi.workspace_id
  and ui.storage_path = wi.storage_path
  and wi.image_id is null;

-- Backfill: outfit_look_items from wardrobe_item_ids array
insert into outfit_look_items (look_id, wardrobe_item_id, sort_order)
select ol.id, unnest_item, ordinality - 1
from outfit_looks ol
cross join lateral unnest(coalesce(ol.wardrobe_item_ids, '{}')) with ordinality as t(unnest_item, ordinality)
where ol.wardrobe_item_ids is not null
  and array_length(ol.wardrobe_item_ids, 1) > 0
on conflict do nothing;

-- Backfill: uploaded_images for generated outfit looks
insert into uploaded_images (
  id, workspace_id, storage_path, status, source, created_at
)
select
  gen_random_uuid(),
  og.workspace_id,
  ol.storage_path,
  'ready',
  'generated',
  ol.created_at
from outfit_looks ol
join outfit_generations og on og.id = ol.generation_id
where ol.storage_path is not null
  and ol.image_id is null
  and not exists (
    select 1 from uploaded_images ui where ui.storage_path = ol.storage_path
  );

update outfit_looks ol
set image_id = ui.id
from uploaded_images ui
where ui.storage_path = ol.storage_path
  and ui.source = 'generated'
  and ol.image_id is null;

-- Default wardrobe in workspace settings
update workspaces w
set settings = jsonb_set(
  coalesce(w.settings, '{}'::jsonb),
  '{default_wardrobe_id}',
  to_jsonb(wr.id::text)
)
from wardrobes wr
where wr.workspace_id = w.id
  and wr.is_default = true
  and (w.settings->>'default_wardrobe_id') is null;

-- Mem0 sync stub (disabled until SDK integrated)
insert into mem0_sync (workspace_id, mem0_user_id, sync_status)
select w.id, w.id::text, 'disabled'
from workspaces w
on conflict (workspace_id) do nothing;

-- Item count trigger
create or replace function sync_wardrobe_item_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    update wardrobes set item_count = item_count + 1, updated_at = now()
    where id = new.wardrobe_id;
  elsif tg_op = 'UPDATE' and old.status != 'confirmed' and new.status = 'confirmed' then
    update wardrobes set item_count = item_count + 1, updated_at = now()
    where id = new.wardrobe_id;
  elsif tg_op = 'DELETE' and old.status = 'confirmed' then
    update wardrobes set item_count = greatest(0, item_count - 1), updated_at = now()
    where id = old.wardrobe_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists wardrobe_items_count_trigger on wardrobe_items;
create trigger wardrobe_items_count_trigger
  after insert or update or delete on wardrobe_items
  for each row execute function sync_wardrobe_item_count();

-- Initialize counts
update wardrobes wr
set item_count = (
  select count(*) from wardrobe_items wi
  where wi.wardrobe_id = wr.id and wi.status = 'confirmed'
);
