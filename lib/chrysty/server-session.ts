import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { withSharedCookieDomain } from "@/lib/supabase/cookie-options";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function getServerSession(
  request: NextRequest,
  response?: NextResponse
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          if (!response) return;
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, withSharedCookieDomain(options));
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}
