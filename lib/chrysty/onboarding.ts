export const ONBOARDING_MIN_PHOTOS = 3;

export type OnboardingPhase =
  | "intro"
  | "name"
  | "workspace_name"
  | "wardrobe"
  | "context"
  | "generating"
  | "feedback"
  | "complete";

export const ONBOARDING_COPY = {
  intro: {
    message: "I'm Chrysty. I help you get dressed using clothes you already own.",
    chips: ["Let's start", "How does this work?"],
    helpReply:
      "Show me a few pieces you wear. I'll put together looks for your day — no shopping, no guesswork.",
  },
  name: { message: "Let's set up your space. What should I call you?" },
  workspaceName: {
    message: "Give this space a name — or keep the default.",
    defaultName: "My Style",
  },
  wardrobe: {
    message:
      "Snap 3 things you wear a lot — a top, bottoms, and shoes. I don't need your whole closet yet.",
    progressLabel: (count: number) =>
      count < ONBOARDING_MIN_PHOTOS
        ? `${count} of ${ONBOARDING_MIN_PHOTOS} pieces`
        : "Ready to style you",
    emptyHint: "Your closet starts with one photo.",
  },
  context: {
    message: "What's coming up — a typical day, or something specific?",
    chips: ["Today", "Work week", "Something special"],
  },
  generating: { message: "Putting a look together…" },
  feedback: {
    message: "Would you wear this?",
    confirmMessage: "Got it. I'll remember that for next time.",
  },
} as const;

export const WELCOME_COPY = {
  headline: "Your personal stylist.",
  subhead: "Show me what you wear. I'll handle the rest.",
  cta: "Meet Chrysty",
} as const;

export const FEEDBACK_OPTIONS = [
  { id: "loved", label: "👍", value: "loved" as const },
  { id: "off", label: "👎", value: "off" as const },
  { id: "almost", label: "Almost", value: "almost" as const },
  { id: "more", label: "More like this", value: "more_like_this" as const },
  { id: "formal", label: "Too formal", value: "too_formal" as const },
] as const;

export type FeedbackValue = (typeof FEEDBACK_OPTIONS)[number]["value"];
