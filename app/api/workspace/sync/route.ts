import { NextResponse } from "next/server";
import { getWorkspaceFromCookie } from "@/lib/workspace/session";
import { ensureUserWorkspaceCookie } from "@/lib/workspace/user-sync";

export async function GET(request: Request) {
  const existing = await getWorkspaceFromCookie();
  if (existing) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    await ensureUserWorkspaceCookie();
    const workspace = await getWorkspaceFromCookie();
    if (workspace) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    // Fall through to welcome.
  }

  return NextResponse.redirect(new URL("/welcome", request.url));
}
