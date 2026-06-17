/**
 * Model selection guide — set in .env.local when benchmarking.
 *
 * OPENAI_CHAT_MODEL        — stylist streaming chat
 * OPENAI_VISION_MODEL      — wardrobe photo analysis (must support vision)
 * OPENAI_MEMORY_MODEL      — async memory merge (optional, defaults to chat)
 * OPENAI_OUTFIT_PLAN_MODEL — JSON outfit item selection (optional, defaults to chat)
 * GEMINI_OUTFIT_PLAN_MODEL — Gemini model for outfit planning (default: gemini-3.5-flash)
 */

export { getModelConfig, isOpenAIConfigured, isGeminiConfigured, requireOpenAI } from "./models";
