"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ThemeToggleInline } from "@/components/theme/theme-toggle-inline";
import { WorkspaceProfileForm } from "@/components/stylist/workspace-profile-form";
import {
  emptyWorkspaceProfile,
  isWorkspaceProfileComplete,
} from "@/lib/chrysty/workspace-profile";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { readJsonResponse } from "@/lib/http/read-json-response";
import type { WorkspaceProfile } from "@/lib/workspace/settings";
import { useUIStore } from "@/store/ui";
import { useMediaQuery } from "@/hooks/use-media-query";

type WorkspaceResponse = {
  workspace?: {
    mission?: string | null;
    profile?: WorkspaceProfile | null;
  } | null;
  error?: string;
};

function profilesEqual(a: WorkspaceProfile, b: WorkspaceProfile): boolean {
  return (
    a.dressingFor === b.dressingFor &&
    a.stylePriority === b.stylePriority &&
    a.styleDescriptors.length === b.styleDescriptors.length &&
    a.styleDescriptors.every((id, i) => id === b.styleDescriptors[i])
  );
}

export function SettingsSheet() {
  const router = useRouter();
  const { activeSheet, closeSheet } = useUIStore();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mission, setMission] = useState("");
  const [profile, setProfile] = useState<WorkspaceProfile>(emptyWorkspaceProfile());
  const [loadedMission, setLoadedMission] = useState("");
  const [loadedProfile, setLoadedProfile] = useState<WorkspaceProfile>(emptyWorkspaceProfile());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace");
      const data = await readJsonResponse<WorkspaceResponse>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const nextMission = data.workspace?.mission ?? "";
      const nextProfile = data.workspace?.profile ?? emptyWorkspaceProfile();
      setMission(nextMission);
      setProfile(nextProfile);
      setLoadedMission(nextMission);
      setLoadedProfile(nextProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSheet === "settings") {
      setSaved(false);
      void loadWorkspace();
    }
  }, [activeSheet, loadWorkspace]);

  async function handleSave() {
    const profileChanged = !profilesEqual(profile, loadedProfile);
    const missionChanged = mission.trim() !== loadedMission.trim();

    if (!missionChanged && !profileChanged) {
      return;
    }

    if (profileChanged && !isWorkspaceProfileComplete(profile)) {
      setError(UI_COPY.workspaces.profileValidation);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: { mission?: string; profile?: WorkspaceProfile } = {};
      if (missionChanged) {
        body.mission = mission.trim();
      }
      if (profileChanged) {
        body.profile = profile;
      }

      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonResponse<WorkspaceResponse>(res);
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setLoadedMission(mission.trim());
      setLoadedProfile(profile);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const profileChanged = !profilesEqual(profile, loadedProfile);
  const missionChanged = mission.trim() !== loadedMission.trim();
  const hasChanges = profileChanged || missionChanged;
  const canSave =
    hasChanges && (!profileChanged || isWorkspaceProfileComplete(profile));

  return (
    <Sheet open={activeSheet === "settings"} onOpenChange={(o) => !o && closeSheet()}>
      <SheetContent side={isDesktop ? "right" : "bottom"} className="overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 className="stylist-heading pr-10 text-lg font-semibold">{UI_COPY.settings.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{UI_COPY.settings.subline}</p>

        <div className="mt-8 space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">{UI_COPY.settings.spaceTitle}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{UI_COPY.settings.spaceSubline}</p>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="settings-mission">
                    {UI_COPY.workspaces.missionLabel}
                  </label>
                  <textarea
                    id="settings-mission"
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    placeholder={UI_COPY.workspaces.missionPlaceholder}
                    disabled={saving}
                    rows={2}
                    className="flex w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <WorkspaceProfileForm
                  value={profile}
                  onChange={setProfile}
                  disabled={saving}
                />

                {error && <p className="text-sm text-destructive">{error}</p>}
                {saved && (
                  <p className="text-sm text-muted-foreground">{UI_COPY.settings.saved}</p>
                )}

                <Button
                  className="w-full justify-center"
                  onClick={() => void handleSave()}
                  disabled={saving || !canSave}
                >
                  {saving ? UI_COPY.settings.saving : UI_COPY.settings.saveCta}
                </Button>
              </>
            )}
          </section>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <span className="text-sm text-muted-foreground">{UI_COPY.theme.label}</span>
            <ThemeToggleInline />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
