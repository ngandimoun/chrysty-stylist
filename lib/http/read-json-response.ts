export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(
      res.ok ? "Invalid server response" : httpErrorMessage(res.status, text)
    );
  }
}

export function httpErrorMessage(status: number, bodyText?: string): string {
  if (status === 504) {
    return "Styling is taking longer than expected — please try again.";
  }
  if (bodyText?.trim()) {
    try {
      const parsed = JSON.parse(bodyText) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      return bodyText.slice(0, 120);
    }
  }
  return `Request failed (${status})`;
}
