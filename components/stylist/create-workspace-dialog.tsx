"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { WorkspaceProfileForm } from "@/components/stylist/workspace-profile-form";
import {
  emptyWorkspaceProfile,
  isWorkspaceProfileComplete,
} from "@/lib/chrysty/workspace-profile";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { readJsonResponse } from "@/lib/http/read-json-response";
import type { WorkspaceProfile } from "@/lib/workspace/settings";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateWorkspaceDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [mission, setMission] = useState("");
  const [profile, setProfile] = useState<WorkspaceProfile>(emptyWorkspaceProfile());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setName("");
    setMission("");
    setProfile(emptyWorkspaceProfile());
    setError(null);
  }

  function applyChip(chip: string) {
    setName(chip);
    if (!mission) {
      const defaults: Record<string, string> = {
        "Work week": "Professional outfits for the office",
        Weekend: "Relaxed, comfortable everyday looks",
        Travel: "Versatile pieces for trips and packing light",
      };
      setMission(defaults[chip] ?? "");
    }
  }

  function goToStep2() {
    const trimmedName = name.trim();
    const trimmedMission = mission.trim();
    if (!trimmedName || !trimmedMission) {
      setError(UI_COPY.workspaces.nameMissionRequired);
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleCreate() {
    if (!isWorkspaceProfileComplete(profile)) {
      setError(UI_COPY.workspaces.profileValidation);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: name.trim(),
          mission: mission.trim(),
          profile,
        }),
      });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to create space");

      onOpenChange(false);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-2 pr-10">
          <h2 className="stylist-heading text-lg font-semibold">
            {UI_COPY.workspaces.createTitle}
          </h2>
          <span className="text-xs text-muted-foreground">
            {step === 1 ? UI_COPY.workspaces.step1Label : UI_COPY.workspaces.step2Label}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {[1, 2].map((s) => (
            <span
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                step >= s ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="workspace-name">
                {UI_COPY.workspaces.nameLabel}
              </label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={UI_COPY.workspaces.namePlaceholder}
                disabled={loading}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {UI_COPY.workspaces.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => applyChip(chip)}
                  disabled={loading}
                  className={cn(
                    "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    name === chip && "border-primary bg-primary/5 text-foreground"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="workspace-mission">
                {UI_COPY.workspaces.missionLabel}
              </label>
              <textarea
                id="workspace-mission"
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder={UI_COPY.workspaces.missionPlaceholder}
                disabled={loading}
                rows={3}
                className="flex w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full justify-center" onClick={goToStep2} disabled={loading}>
              {UI_COPY.workspaces.nextCta}
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <WorkspaceProfileForm value={profile} onChange={setProfile} disabled={loading} />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 justify-center"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                {UI_COPY.workspaces.backCta}
              </Button>
              <Button
                className="flex-1 justify-center"
                onClick={() => void handleCreate()}
                disabled={loading || !isWorkspaceProfileComplete(profile)}
              >
                {loading ? "Creating…" : UI_COPY.workspaces.createCta}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
