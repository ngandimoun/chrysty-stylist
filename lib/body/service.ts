import {
  createAdminClient,
  signStoragePathWithFallback,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import {
  BODY_UPLOAD_MAX,
  type BodyReferenceType,
} from "@/lib/uploads/limits";
import type { UploadedImage } from "@/types/database";

function parseReferenceType(vision: unknown): BodyReferenceType {
  if (!vision || typeof vision !== "object" || Array.isArray(vision)) return "body";
  const raw = (vision as { referenceType?: unknown }).referenceType;
  if (raw === "face" || raw === "mannequin" || raw === "body") return raw;
  return "body";
}

export async function countBodyReferences(workspaceId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("source", "body")
    .eq("status", "ready")
    .is("deleted_at", null);

  if (error) throw error;
  return count ?? 0;
}

export type BodyReference = {
  id: string;
  imageUrl: string;
  referenceType: BodyReferenceType;
  storagePath: string;
};

export async function listBodyReferences(workspaceId: string): Promise<BodyReference[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("source", "body")
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data?.length) return [];

  return Promise.all(
    (data as UploadedImage[]).map(async (row) => {
      const primaryPath = row.thumb_path ?? row.storage_path;
      return {
        id: row.id,
        imageUrl: await signStoragePathWithFallback(
          STORAGE_BUCKETS.uploads,
          primaryPath,
          row.storage_path
        ),
        referenceType: parseReferenceType(row.vision),
        storagePath: row.storage_path,
      };
    })
  );
}

export async function assertBodyUploadAllowed(workspaceId: string) {
  const count = await countBodyReferences(workspaceId);
  if (count >= BODY_UPLOAD_MAX) {
    throw new Error(`Body reference limit reached (${BODY_UPLOAD_MAX})`);
  }
}

export function summarizeBodyReferences(refs: BodyReference[]): string | undefined {
  if (!refs.length) return undefined;
  const types = refs.map((r) => r.referenceType).join(", ");
  return `${refs.length} body reference photo(s): ${types}`;
}

export async function deleteBodyReference(workspaceId: string, imageId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .select("id")
    .eq("id", imageId)
    .eq("workspace_id", workspaceId)
    .eq("source", "body")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Body reference not found");

  const { error: updateError } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", imageId);

  if (updateError) throw updateError;
}

export { BODY_UPLOAD_MAX };
