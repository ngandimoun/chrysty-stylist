export function getModelConfig() {
  return {
    openai: {
      chat: process.env.OPENAI_CHAT_MODEL ?? "",
      vision: process.env.OPENAI_VISION_MODEL ?? "",
      memory: process.env.OPENAI_MEMORY_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "",
      outfitPlan: process.env.OPENAI_OUTFIT_PLAN_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      outfitPlan: process.env.GEMINI_OUTFIT_PLAN_MODEL ?? "gemini-3.5-flash",
    },
  };
}

export function requireOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

export function isOpenAIConfigured() {
  const c = getModelConfig();
  return Boolean(process.env.OPENAI_API_KEY && c.openai.chat && c.openai.vision);
}

export function requireGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

export function isGeminiConfigured() {
  const c = getModelConfig();
  return Boolean(c.gemini.apiKey && c.gemini.outfitPlan);
}
