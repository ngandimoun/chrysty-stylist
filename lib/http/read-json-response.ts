export async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(
      res.ok ? "Invalid server response" : text.slice(0, 120) || `Request failed (${res.status})`
    );
  }
}
