import { auth } from "@chrysty/platform";
import { NextResponse, type NextRequest } from "next/server";
import { configurePlatformForToken } from "@/lib/chrysty/platform";
import { getServerSession } from "@/lib/chrysty/server-session";

export async function GET(request: NextRequest) {
  const cookieResponse = NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const session = await getServerSession(request, cookieResponse);

  if (!session?.access_token) {
    return cookieResponse;
  }

  configurePlatformForToken(session.access_token);

  try {
    const user = await auth.getUser();
    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      { headers: cookieResponse.headers }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}
