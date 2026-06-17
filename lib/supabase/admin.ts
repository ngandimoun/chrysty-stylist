import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isSupabaseConfigured as isConfigured } from "@/lib/config/setup";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured() {
  return isConfigured();
}

export const STORAGE_BUCKETS = {
  uploads: "worker-uploads",
} as const;

export const STYLIST_STORAGE_PREFIX = "stylist";

export function stylistWardrobePath(
  workspaceId: string,
  imageId: string,
  ext: string
) {
  return `${STYLIST_STORAGE_PREFIX}/wardrobe/${workspaceId}/${imageId}/original.${ext}`;
}

export function stylistBodyPath(workspaceId: string, imageId: string, ext: string) {
  return `${STYLIST_STORAGE_PREFIX}/body/${workspaceId}/${imageId}/original.${ext}`;
}

export function stylistOutfitPath(
  workspaceId: string,
  generationId: string,
  lookId: string
) {
  return `${STYLIST_STORAGE_PREFIX}/outfits/${workspaceId}/${generationId}/${lookId}.jpg`;
}

export const SIGNED_URL_TTL = 60 * 60 * 24;

export async function signStoragePath(
  bucket: string,
  path: string,
  ttl = SIGNED_URL_TTL
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, ttl);
  if (error) throw error;
  return data.signedUrl;
}

export async function signStoragePathWithFallback(
  bucket: string,
  primaryPath: string,
  fallbackPath?: string | null,
  ttl = SIGNED_URL_TTL
) {
  try {
    return await signStoragePath(bucket, primaryPath, ttl);
  } catch (primaryError) {
    if (fallbackPath && fallbackPath !== primaryPath) {
      return await signStoragePath(bucket, fallbackPath, ttl);
    }
    throw primaryError;
  }
}
