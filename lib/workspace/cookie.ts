import { withSharedCookieDomain } from "@/lib/supabase/cookie-options";

export const WORKSPACE_COOKIE = "stylist_ws";
export const WORKSPACE_REGISTRY_COOKIE = "stylist_ws_registry";
export const ONBOARDING_COOKIE = "stylist_onboarded";

export function getCookieOptions(maxAge = 60 * 60 * 24 * 365) {
  return withSharedCookieDomain({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  });
}
