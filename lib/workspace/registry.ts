import { cookies } from "next/headers";
import { getCookieOptions, WORKSPACE_REGISTRY_COOKIE } from "@/lib/workspace/cookie";

const MAX_REGISTRY_TOKENS = 20;

function parseRegistry(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((token): token is string => typeof token === "string" && token.length > 0);
  } catch {
    return [];
  }
}

export async function getRegistryTokens(): Promise<string[]> {
  const cookieStore = await cookies();
  return parseRegistry(cookieStore.get(WORKSPACE_REGISTRY_COOKIE)?.value);
}

export async function ensureRegistrySeeded(activeToken: string | undefined): Promise<string[]> {
  const cookieStore = await cookies();
  const existing = parseRegistry(cookieStore.get(WORKSPACE_REGISTRY_COOKIE)?.value);

  if (existing.length > 0) {
    return existing;
  }

  if (!activeToken) {
    return [];
  }

  const seeded = [activeToken];
  cookieStore.set(WORKSPACE_REGISTRY_COOKIE, JSON.stringify(seeded), getCookieOptions());
  return seeded;
}

export async function addTokenToRegistry(token: string): Promise<string[]> {
  const cookieStore = await cookies();
  const existing = parseRegistry(cookieStore.get(WORKSPACE_REGISTRY_COOKIE)?.value);
  const next = [token, ...existing.filter((t) => t !== token)].slice(0, MAX_REGISTRY_TOKENS);

  cookieStore.set(WORKSPACE_REGISTRY_COOKIE, JSON.stringify(next), getCookieOptions());
  return next;
}

export async function isTokenInRegistry(token: string): Promise<boolean> {
  const tokens = await getRegistryTokens();
  return tokens.includes(token);
}
