/**
 * Model selection guide — set in .env.local when benchmarking.
 *
 * OPENAI_CHAT_MODEL        — stylist streaming chat
 * OPENAI_VISION_MODEL      — wardrobe photo analysis (must support vision)
 * OPENAI_MEMORY_MODEL      — async memory merge (optional, defaults to chat)
 * OPENAI_OUTFIT_PLAN_MODEL — JSON outfit item selection (optional, defaults to chat)
 * GEMINI_OUTFIT_PLAN_MODEL — Gemini model for outfit planning (default: gemini-3.5-flash)
 * GEMINI_OUTFIT_PLAN_TIMEOUT_MS — per-call abort for outfit planning (default: 90000)
 *
 * Default fallback chain on transient errors:
 *   gemini-3.1-flash-lite, gemini-3.1-pro-preview, gemini-flash-lite-latest, gemini-pro-latest
 */

export { getModelConfig, isOpenAIConfigured, isGeminiConfigured, requireOpenAI } from "./models";
