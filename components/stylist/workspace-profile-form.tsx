"use client";

import {
  STYLE_DESCRIPTORS_MAX,
  WORKSPACE_PROFILE_QUESTIONS,
} from "@/lib/chrysty/workspace-profile";
import type { WorkspaceProfile } from "@/lib/workspace/settings";
import { cn } from "@/lib/utils";

type Props = {
  value: WorkspaceProfile;
  onChange: (profile: WorkspaceProfile) => void;
  disabled?: boolean;
};

export function WorkspaceProfileForm({ value, onChange, disabled }: Props) {
  function setSingle(field: "dressingFor" | "stylePriority", id: string) {
    onChange({ ...value, [field]: id });
  }

  function toggleStyle(id: string) {
    const current = value.styleDescriptors;
    if (current.includes(id)) {
      onChange({ ...value, styleDescriptors: current.filter((x) => x !== id) });
      return;
    }
    if (current.length >= STYLE_DESCRIPTORS_MAX) return;
    onChange({ ...value, styleDescriptors: [...current, id] });
  }

  return (
    <div className="space-y-8">
      {WORKSPACE_PROFILE_QUESTIONS.map((question) => {
        const isMulti = question.type === "multi";
        const selectedCount = isMulti ? value.styleDescriptors.length : 0;
        const atMax = isMulti && selectedCount >= (question.max ?? STYLE_DESCRIPTORS_MAX);

        return (
          <div key={question.id} className="space-y-3">
            <div>
              <p className="stylist-heading text-sm font-medium">{question.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {question.hint}
                {isMulti && (
                  <span className="ml-1 text-foreground/70">
                    ({selectedCount}/{question.max ?? STYLE_DESCRIPTORS_MAX})
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {question.choices.map((choice) => {
                const active = isMulti
                  ? value.styleDescriptors.includes(choice.id)
                  : value[question.id as "dressingFor" | "stylePriority"] === choice.id;
                const choiceDisabled =
                  disabled || (isMulti && atMax && !value.styleDescriptors.includes(choice.id));

                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={choiceDisabled}
                    onClick={() => {
                      if (isMulti) {
                        toggleStyle(choice.id);
                      } else if (question.id === "dressingFor") {
                        setSingle("dressingFor", choice.id);
                      } else {
                        setSingle("stylePriority", choice.id);
                      }
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      choiceDisabled && !active && "cursor-not-allowed opacity-40"
                    )}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
