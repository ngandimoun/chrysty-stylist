-- Stylist worker schema for chrysty.dev platform
-- Safe: only creates stylist_* tables; does not alter other worker tables

create extension if not exists "pgcrypto";

insert into workers (slug, name, status)
values ('stylist', 'AI Stylist', 'active')
on conflict (slug) do update
  set name = excluded.name,
      status = excluded.status;

-- See Supabase migration `stylist_worker_schema` for full DDL.
-- Tables: stylist_workspaces, stylist_wardrobes, stylist_uploaded_images,
-- stylist_wardrobe_items, stylist_conversations, stylist_messages,
-- stylist_outfit_generations, stylist_outfit_looks, stylist_outfit_look_items,
-- stylist_memory_summaries, stylist_preference_signals, stylist_mem0_sync,
-- stylist_mem0_memory_refs
