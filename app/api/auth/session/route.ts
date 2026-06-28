import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "@/lib/chrysty/server-session";

export async function GET(request: NextRequest) {
  const response = NextResponse.json({
    valid: false,
    expiresAt: null as string | null,
  });

  const session = await getServerSession(request, response);

  return NextResponse.json(
    {
      valid: Boolean(session?.access_token),
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    },
    {
      headers: response.headers,
    }
  );
}
