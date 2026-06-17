/** Stylist worker tables — isolated namespace on shared chrysty.dev Supabase project. */
export const STYLIST_TABLES = {
  workspaces: "stylist_workspaces",
  wardrobes: "stylist_wardrobes",
  uploadedImages: "stylist_uploaded_images",
  wardrobeItems: "stylist_wardrobe_items",
  conversations: "stylist_conversations",
  messages: "stylist_messages",
  outfitGenerations: "stylist_outfit_generations",
  outfitLooks: "stylist_outfit_looks",
  outfitLookItems: "stylist_outfit_look_items",
  memorySummaries: "stylist_memory_summaries",
  preferenceSignals: "stylist_preference_signals",
  mem0Sync: "stylist_mem0_sync",
  mem0MemoryRefs: "stylist_mem0_memory_refs",
} as const;

export const STYLIST_WORKER_SLUG = "stylist" as const;
