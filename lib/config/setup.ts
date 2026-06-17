export function getMissingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  return missing;
}

export function isSupabaseConfigured() {
  return getMissingSupabaseEnv().length === 0;
}

export function isOpenAIOptional() {
  return !process.env.OPENAI_API_KEY;
}
