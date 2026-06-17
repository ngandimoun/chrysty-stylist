import { generateLog } from "@/lib/chrysty/generate-debug";

const DEFAULT_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorText(error: unknown): string {
  if (error instanceof Error) {
    return [error.message, error.cause ? extractErrorText(error.cause) : ""]
      .filter(Boolean)
      .join(" ");
  }
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const nested = record.error;
    if (nested && typeof nested === "object") {
      const err = nested as Record<string, unknown>;
      return [err.message, err.status, err.code].filter(Boolean).join(" ");
    }
    if (typeof record.message === "string") return record.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function isGeminiTransientError(error: unknown): boolean {
  const text = extractErrorText(error);
  return /503|429|UNAVAILABLE|high demand|overloaded|resource exhausted|temporarily unavailable/i.test(
    text
  );
}

export function getGeminiModelCandidates(primaryModel: string): string[] {
  const fromEnv =
    process.env.GEMINI_FALLBACK_MODELS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  return [...new Set([primaryModel, ...fromEnv, ...DEFAULT_FALLBACK_MODELS])];
}

export async function generateContentWithRetry<T>(
  call: (model: string) => Promise<T>,
  primaryModel: string,
  options?: { maxAttemptsPerModel?: number; baseDelayMs?: number }
): Promise<T> {
  const models = getGeminiModelCandidates(primaryModel);
  const maxAttempts = options?.maxAttemptsPerModel ?? 2;
  const baseDelay = options?.baseDelayMs ?? 1500;
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await call(model);
      } catch (error) {
        lastError = error;
        if (!isGeminiTransientError(error)) throw error;

        const isLastModel = model === models[models.length - 1];
        const isLastAttempt = attempt === maxAttempts - 1;
        if (isLastModel && isLastAttempt) break;

        const delay = baseDelay * 2 ** attempt;
        generateLog("gemini_retry", { model, attempt: attempt + 1, delayMs: delay });
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
