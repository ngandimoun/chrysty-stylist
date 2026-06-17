import type { WorkspaceProfile } from "@/lib/workspace/settings";

export type ProfileChoice = { id: string; label: string };

export type ProfileQuestion = {
  id: keyof WorkspaceProfile;
  label: string;
  hint: string;
  type: "single" | "multi";
  max?: number;
  choices: ProfileChoice[];
};

export const DRESSING_FOR_CHOICES: ProfileChoice[] = [
  { id: "work", label: "Work" },
  { id: "travel", label: "Travel" },
  { id: "school", label: "School" },
  { id: "business", label: "Business" },
  { id: "casual", label: "Casual" },
  { id: "events", label: "Events" },
  { id: "dates", label: "Dates" },
  { id: "gym", label: "Gym & active" },
  { id: "weekends", label: "Weekends" },
  { id: "mix", label: "Mix of everything" },
];

export const STYLE_DESCRIPTOR_CHOICES: ProfileChoice[] = [
  { id: "minimalist", label: "Minimalist" },
  { id: "classic", label: "Classic" },
  { id: "japanese", label: "Japanese" },
  { id: "korean", label: "Korean" },
  { id: "london_street", label: "London street" },
  { id: "congolese", label: "Congolese" },
  { id: "paris_by_night", label: "Paris by night" },
  { id: "streetwear", label: "Streetwear" },
  { id: "business", label: "Business" },
  { id: "luxury", label: "Luxury" },
  { id: "creative", label: "Creative" },
  { id: "bohemian", label: "Bohemian" },
  { id: "sporty", label: "Sporty" },
  { id: "not_sure", label: "Not sure yet" },
  { id: "avant_garde", label: "Avant-garde" },
  { id: "preppy", label: "Preppy" },
  { id: "romantic", label: "Romantic" },
  { id: "vintage", label: "Vintage" },
  { id: "grunge", label: "Grunge" },
  { id: "old_money", label: "Old money" },
  { id: "y2k", label: "Y2K" },
  { id: "scandinavian", label: "Scandinavian" },
  { id: "afrocentric", label: "Afrocentric" },
  { id: "african_prints", label: "African prints" },
  { id: "milanese", label: "Milanese" },
  { id: "nyc_downtown", label: "NYC downtown" },
  { id: "la_casual", label: "LA casual" },
  { id: "cottagecore", label: "Cottagecore" },
  { id: "goth", label: "Goth" },
  { id: "tailored", label: "Tailored" },
  { id: "eclectic", label: "Eclectic" },
  { id: "ibiza_summer", label: "Ibiza summer" },
];

export const STYLE_PRIORITY_CHOICES: ProfileChoice[] = [
  { id: "professional", label: "Look professional" },
  { id: "attractive", label: "Look attractive" },
  { id: "comfortable", label: "Be comfortable" },
  { id: "stand_out", label: "Stand out" },
  { id: "save_money", label: "Save money" },
  { id: "confidence", label: "Build confidence" },
  { id: "express", label: "Express myself" },
  { id: "fit_in", label: "Fit in" },
  { id: "authentic", label: "Feel authentic" },
  { id: "polished", label: "Look polished" },
  { id: "practical", label: "Stay practical" },
  { id: "simple", label: "Keep it simple" },
  { id: "easy_dressing", label: "Make getting dressed easy" },
  { id: "creative", label: "Inspire creativity" },
  { id: "fresh", label: "Look fresh" },
  { id: "refined", label: "Look refined" },
  { id: "lifestyle", label: "Dress for my lifestyle" },
  { id: "photo_ready", label: "Dress for photos" },
];

export const WORKSPACE_PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: "dressingFor",
    label: "What are you usually dressing for?",
    hint: "This shapes every recommendation in this space.",
    type: "single",
    choices: DRESSING_FOR_CHOICES,
  },
  {
    id: "styleDescriptors",
    label: "How would you describe your style?",
    hint: "Pick up to 3 — mix cultures and moods freely.",
    type: "multi",
    max: 3,
    choices: STYLE_DESCRIPTOR_CHOICES,
  },
  {
    id: "stylePriority",
    label: "What's most important to you?",
    hint: "Two people with the same closet may want different outcomes.",
    type: "single",
    choices: STYLE_PRIORITY_CHOICES,
  },
];

const CHOICE_MAP = new Map(
  [...DRESSING_FOR_CHOICES, ...STYLE_DESCRIPTOR_CHOICES, ...STYLE_PRIORITY_CHOICES].map((c) => [
    c.id,
    c.label,
  ])
);

export function labelForChoice(id: string): string {
  return CHOICE_MAP.get(id) ?? id;
}

export function emptyWorkspaceProfile(): WorkspaceProfile {
  return {
    dressingFor: "",
    styleDescriptors: [],
    stylePriority: "",
  };
}

export function isWorkspaceProfileComplete(profile: WorkspaceProfile): boolean {
  return (
    Boolean(profile.dressingFor) &&
    profile.styleDescriptors.length > 0 &&
    Boolean(profile.stylePriority)
  );
}

export function buildProfileSummary(profile: WorkspaceProfile | undefined): string | undefined {
  if (!profile || !isWorkspaceProfileComplete(profile)) return undefined;

  const styles = profile.styleDescriptors.map(labelForChoice).join(", ");
  return `${labelForChoice(profile.dressingFor)} · ${styles} · ${labelForChoice(profile.stylePriority)}`;
}

export function buildStylingContext(params: {
  mission?: string;
  profile?: WorkspaceProfile;
}): string | undefined {
  const parts: string[] = [];
  if (params.mission?.trim()) {
    parts.push(`Space mission: ${params.mission.trim()}`);
  }
  if (params.profile && isWorkspaceProfileComplete(params.profile)) {
    parts.push(
      `User dresses for: ${labelForChoice(params.profile.dressingFor)}.`,
      `Style: ${params.profile.styleDescriptors.map(labelForChoice).join(", ")}.`,
      `Priority: ${labelForChoice(params.profile.stylePriority)}.`
    );
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export const STYLE_DESCRIPTORS_MAX = 3;
