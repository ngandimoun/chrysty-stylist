import type { Workspace } from "@/types/database";
import { buildProfileSummary } from "@/lib/chrysty/workspace-profile";
import { parseWorkspaceSettings } from "@/lib/workspace/settings";

export type WorkspaceSummary = {
  id: string;
  name: string;
  mission: string | null;
  visitorToken: string;
  onboardingComplete: boolean;
  isActive: boolean;
};

export function toWorkspaceSummary(
  workspace: Pick<
    Workspace,
    "id" | "name" | "visitor_token" | "onboarding_complete" | "settings"
  >,
  activeToken: string | undefined
): WorkspaceSummary {
  const settings = parseWorkspaceSettings(workspace.settings);
  const profileSummary = buildProfileSummary(settings.profile);
  return {
    id: workspace.id,
    name: workspace.name,
    mission: profileSummary ?? settings.mission ?? null,
    visitorToken: workspace.visitor_token,
    onboardingComplete: workspace.onboarding_complete,
    isActive: workspace.visitor_token === activeToken,
  };
}
