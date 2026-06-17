const PREFIX = "[generate]";

function isEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.GENERATE_DEBUG === "true";
}

export function generateLog(phase: string, detail?: Record<string, unknown>) {
  if (!isEnabled()) return;
  if (detail) {
    console.log(`${PREFIX} ${phase}`, detail);
  } else {
    console.log(`${PREFIX} ${phase}`);
  }
}

export function generateError(phase: string, error: unknown) {
  if (!isEnabled()) return;
  const normalized = normalizeGenerationError(error);
  console.error(`${PREFIX} ${phase} FAILED`, normalized);
}

export function normalizeGenerationError(error: unknown): {
  message: string;
  cause?: string;
} {
  if (error instanceof Error) {
    const isTimeout =
      error.name === "AbortError" ||
      /aborted|timeout/i.test(error.message);
    const isModelBusy =
      /high demand|UNAVAILABLE|503|overloaded|resource exhausted/i.test(error.message);
    return {
      message: isTimeout
        ? "Styling took too long — please try again."
        : isModelBusy
          ? "The styling model is busy right now — please try again in a minute."
          : error.message,
      cause:
        error.cause instanceof Error
          ? error.cause.message
          : error.cause
            ? String(error.cause)
            : undefined,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const nested =
      record.error instanceof Error
        ? record.error.message
        : typeof record.message === "string"
          ? record.message
          : undefined;
    if (nested) {
      return normalizeGenerationError(
        nested.includes("aborted") ? new Error(nested, { cause: error }) : new Error(nested)
      );
    }
  }

  return { message: typeof error === "string" ? error : "Generation failed" };
}
