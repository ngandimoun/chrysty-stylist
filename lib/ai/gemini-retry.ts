import { generateLog } from "@/lib/chrysty/generate-debug";

const DEFAULT_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
];

export type GenerateContentRetryOptions = {
  maxAttemptsPerModel?: number;
  baseDelayMs?: number;
  deadlineMs?: number;
  maxModels?: number;
};

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

function resolveModelList(primaryModel: string, maxModels?: number): string[] {
  const models = getGeminiModelCandidates(primaryModel);
  if (maxModels === undefined) return models;
  return models.slice(0, Math.max(1, maxModels));
}

export async function generateContentWithRetry<T>(
  call: (model: string) => Promise<T>,
  primaryModel: string,
  options?: GenerateContentRetryOptions
): Promise<T> {
  const models = resolveModelList(primaryModel, options?.maxModels);
  const maxAttempts = options?.maxAttemptsPerModel ?? 2;
  const baseDelay = options?.baseDelayMs ?? 1500;
  const deadlineAt =
    options?.deadlineMs !== undefined ? Date.now() + options.deadlineMs : null;
  let lastError: unknown;

  for (const model of models) {
    if (deadlineAt !== null && Date.now() >= deadlineAt) {
      generateLog("gemini_retry_budget_exhausted", {
        primaryModel,
        modelsTried: models.indexOf(model),
      });
      break;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (deadlineAt !== null && Date.now() >= deadlineAt) {
        generateLog("gemini_retry_budget_exhausted", { model, attempt });
        break;
      }

      try {
        return await call(model);
      } catch (error) {
        lastError = error;
        if (!isGeminiTransientError(error)) throw error;

        const isLastModel = model === models[models.length - 1];
        const isLastAttempt = attempt === maxAttempts - 1;
        if (isLastModel && isLastAttempt) break;

        const delay = baseDelay * 2 ** attempt;
        if (deadlineAt !== null && Date.now() + delay >= deadlineAt) {
          generateLog("gemini_retry_budget_exhausted", { model, attempt, delayMs: delay });
          break;
        }

        generateLog("gemini_retry", { model, attempt: attempt + 1, delayMs: delay });
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
