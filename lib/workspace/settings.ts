import type { Json } from "@/types/database";

export type WorkspaceProfile = {
  dressingFor: string;
  styleDescriptors: string[];
  stylePriority: string;
};

export type WorkspaceSettings = {
  default_wardrobe_id?: string;
  mission?: string;
  profile?: WorkspaceProfile;
};

function parseProfile(raw: unknown): WorkspaceProfile | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const p = raw as Record<string, unknown>;
  const dressingFor = typeof p.dressingFor === "string" ? p.dressingFor : "";
  const stylePriority = typeof p.stylePriority === "string" ? p.stylePriority : "";
  const styleDescriptors = Array.isArray(p.styleDescriptors)
    ? p.styleDescriptors.filter((v): v is string => typeof v === "string")
    : [];
  if (!dressingFor && styleDescriptors.length === 0 && !stylePriority) {
    return undefined;
  }
  return { dressingFor, styleDescriptors, stylePriority };
}

export function parseWorkspaceSettings(settings: Json | null | undefined): WorkspaceSettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }
  const raw = settings as Record<string, unknown>;
  return {
    default_wardrobe_id:
      typeof raw.default_wardrobe_id === "string" ? raw.default_wardrobe_id : undefined,
    mission: typeof raw.mission === "string" ? raw.mission : undefined,
    profile: parseProfile(raw.profile),
  };
}

export function mergeWorkspaceSettings(
  existing: Json | null | undefined,
  patch: Partial<WorkspaceSettings>
): WorkspaceSettings {
  const current = parseWorkspaceSettings(existing);
  return {
    ...current,
    ...patch,
    profile: patch.profile !== undefined ? patch.profile : current.profile,
  };
}
