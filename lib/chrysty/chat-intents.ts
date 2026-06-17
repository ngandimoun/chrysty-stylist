export type ChatIntent = "daily" | "event" | "style_confidence" | "memory" | "general";

const INTENT_PATTERNS: { intent: ChatIntent; patterns: RegExp[] }[] = [
  {
    intent: "daily",
    patterns: [/what should i wear today/i, /outfit for today/i, /dress for today/i],
  },
  {
    intent: "event",
    patterns: [/interview/i, /wedding/i, /date/i, /dinner/i, /party/i, /tonight/i, /tomorrow/i],
  },
  {
    intent: "style_confidence",
    patterns: [/my style/i, /look more polished/i, /find my look/i, /more confident/i],
  },
  {
    intent: "memory",
    patterns: [/what do you remember/i, /do you remember/i],
  },
];

export function detectChatIntent(message: string): ChatIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(message.trim()))) return intent;
  }
  return "general";
}

export const SUGGESTION_CHIPS = {
  daily: "What should I wear today?",
  event: "Help me for tonight",
  addClothes: "Add more to my closet",
  memory: "What do you remember?",
} as const;

export function getDefaultChips(hasWardrobe: boolean): string[] {
  if (!hasWardrobe) return ["Let's start"];
  return [SUGGESTION_CHIPS.daily, SUGGESTION_CHIPS.event, SUGGESTION_CHIPS.addClothes];
}

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const OUTFIT_RESPONSE_TEMPLATE = {
  minLooks: 2,
  maxLooks: 4,
  heroLabel: "Chrysty's pick",
  introByIntent: {
    daily: "For today — here are a few directions.",
    event: "For your occasion — here are a few directions.",
    style_confidence: "Let's find your vibe — here are a few directions.",
    general: "Here's what I'd put together.",
    memory: "",
  } as Record<ChatIntent, string>,
} as const;
