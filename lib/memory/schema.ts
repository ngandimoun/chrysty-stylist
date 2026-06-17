export const MEMORY_SECTIONS = ["about", "words", "works", "avoid"] as const;
export type MemorySection = (typeof MEMORY_SECTIONS)[number];

export const MEMORY_SECTION_LABELS: Record<MemorySection, string> = {
  about: "About you",
  words: "Your words",
  works: "What works",
  avoid: "What to avoid",
};

export type MemorySectionContent = { bullets: string[] };

export type WardrobeItemMetadata = {
  category: string;
  description: string;
  colors: string[];
  formality: string;
  season?: string[];
  keywords?: string[];
};

export const EMPTY_MEMORY: Record<MemorySection, MemorySectionContent> = {
  about: { bullets: [] },
  words: { bullets: [] },
  works: { bullets: [] },
  avoid: { bullets: [] },
};
