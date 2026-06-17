-- Chrysty AI Stylist schema
create extension if not exists "pgcrypto";

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Style',
  display_name text,
  visitor_token text unique not null,
  user_id uuid,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  category text,
  colors text[] default '{}',
  description text not null default '',
  formality text,
  status text not null default 'pending',
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists wardrobe_items_workspace_id_idx on wardrobe_items(workspace_id);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on messages(conversation_id);

create table if not exists outfit_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  prompt_context jsonb default '{}',
  stylist_pick_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists outfit_looks (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references outfit_generations(id) on delete cascade,
  storage_path text not null,
  wardrobe_item_ids uuid[] default '{}',
  rationale text not null default '',
  vibe text,
  occasion_tag text,
  is_stylist_pick boolean not null default false,
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists memory_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  section text not null check (section in ('about', 'words', 'works', 'avoid')),
  content jsonb not null default '{"bullets":[]}',
  updated_at timestamptz not null default now(),
  unique (workspace_id, section)
);

create table if not exists preference_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  signal_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists preference_signals_workspace_id_idx on preference_signals(workspace_id);
