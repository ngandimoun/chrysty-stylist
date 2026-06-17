"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, PanelLeftClose, Plus, ScanFace, Shirt, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "@/components/stylist/create-workspace-dialog";
import { UploadPreviewStack } from "@/components/stylist/upload-preview-stack";
import type { UploadAsset } from "@/components/stylist/upload-types";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { readJsonResponse } from "@/lib/http/read-json-response";
import { BODY_UPLOAD_MAX, WARDROBE_UPLOAD_MAX } from "@/lib/uploads/limits";
import type { WorkspaceSummary } from "@/lib/workspace/serialize";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

type Props = {
  workspaceId: string;
  workspaceName: string;
  workspaceMission: string | null;
  bodyCount: number;
  wardrobeCount: number;
  bodyItems: UploadAsset[];
  wardrobeItems: UploadAsset[];
  onBodyUpload: () => void;
  onWardrobeUpload: () => void;
  onClose?: () => void;
};

function truncate(text: string, max = 48) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function StylistSidebar({
  workspaceId,
  workspaceName,
  workspaceMission,
  bodyCount,
  wardrobeCount,
  bodyItems,
  wardrobeItems,
  onBodyUpload,
  onWardrobeUpload,
  onClose,
}: Props) {
  const router = useRouter();
  const openSettings = useUIStore((s) => s.openSettings);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    const data = await readJsonResponse<{ workspaces?: WorkspaceSummary[] }>(res);
    setWorkspaces((data.workspaces ?? []) as WorkspaceSummary[]);
  }, []);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces, workspaceId]);

  async function switchWorkspace(id: string) {
    if (id === workspaceId || switchingId) return;

    setSwitchingId(id);
    try {
      const res = await fetch("/api/workspaces/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) {
        const data = await readJsonResponse<{ error?: string }>(res);
        throw new Error(data.error ?? "Failed to switch");
      }
      closeSheet();
      router.refresh();
    } finally {
      setSwitchingId(null);
    }
  }

  const bodyFull = bodyCount >= BODY_UPLOAD_MAX;
  const wardrobeFull = wardrobeCount >= WARDROBE_UPLOAD_MAX;
  const isEmpty = bodyCount === 0 && wardrobeCount === 0;

  return (
    <>
      <aside className="relative z-20 flex max-h-[42dvh] w-full shrink-0 flex-col overflow-y-auto border-b border-border/60 bg-background p-6 lg:sticky lg:top-0 lg:h-svh lg:max-h-none lg:overflow-visible lg:w-[320px] lg:border-b-0 lg:border-r lg:p-8">
        <div className="flex shrink-0 items-start gap-3">
          <button
            type="button"
            onClick={openSettings}
            className="stylist-mark shrink-0 cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={UI_COPY.settings.openLabel}
          >
            C
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="stylist-heading text-lg font-semibold">Chrysty</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-0.5 flex w-full items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={UI_COPY.workspaces.switchLabel}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {workspaceName}
                    </span>
                    {workspaceMission && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {truncate(workspaceMission, 40)}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>{UI_COPY.workspaces.switchLabel}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    disabled={switchingId !== null}
                    onClick={() => void switchWorkspace(ws.id)}
                    className="flex flex-col items-start gap-0.5 py-2.5"
                  >
                    <span className="flex w-full items-center gap-2 font-medium">
                      <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                      {ws.isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </span>
                    {ws.mission && (
                      <span className="truncate text-xs text-muted-foreground">
                        {truncate(ws.mission, 52)}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label={UI_COPY.workspaces.addLabel}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground"
                aria-label={UI_COPY.sidebar.closeLabel}
                onClick={onClose}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-4 py-8">
          <div className="space-y-1">
            <p className="text-sm font-medium">{UI_COPY.uploads.sectionTitle}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {UI_COPY.uploads.sectionHint}
            </p>
            {isEmpty && (
              <p className="pt-1 text-xs font-medium text-primary">
                {UI_COPY.uploads.emptyHint}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onBodyUpload}
              disabled={bodyFull}
              className={cn(
                "group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                bodyFull
                  ? "border-dashed border-border/70 bg-muted/10"
                  : "border-border/70 bg-muted/20 hover:border-primary/30 hover:bg-muted/40"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScanFace className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{UI_COPY.uploads.body.buttonTitle}</span>
                  <span className="text-xs text-muted-foreground">
                    {bodyCount} / {BODY_UPLOAD_MAX}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {bodyFull
                    ? UI_COPY.uploads.body.limitReached
                    : UI_COPY.uploads.body.buttonSubtitle}
                </span>
                <UploadPreviewStack items={bodyItems} />
                {bodyCount > 0 && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {UI_COPY.uploads.managePhotos}
                  </span>
                )}
                {!bodyFull && (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    <Upload className="h-3 w-3" />
                    {UI_COPY.uploads.tapToUpload}
                  </span>
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={onWardrobeUpload}
              disabled={wardrobeFull}
              className={cn(
                "group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                wardrobeFull
                  ? "border-dashed border-border/70 bg-muted/10"
                  : wardrobeCount === 0
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 hover:border-primary/50 hover:bg-primary/10"
                    : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/30"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Shirt className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{UI_COPY.uploads.wardrobe.buttonTitle}</span>
                  <span className="text-xs text-muted-foreground">
                    {wardrobeCount} / {WARDROBE_UPLOAD_MAX}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {wardrobeFull
                    ? UI_COPY.uploads.wardrobe.limitReached
                    : UI_COPY.uploads.wardrobe.buttonSubtitle}
                </span>
                <UploadPreviewStack items={wardrobeItems} />
                {wardrobeCount > 0 && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {UI_COPY.uploads.managePhotos}
                  </span>
                )}
                {!wardrobeFull && (
                  <span
                    className={cn(
                      "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                      wardrobeCount === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                    )}
                  >
                    <Upload className="h-3 w-3" />
                    {UI_COPY.uploads.tapToUpload}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </aside>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
