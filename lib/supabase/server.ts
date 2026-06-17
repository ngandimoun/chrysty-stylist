import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { auth } from "@chrysty/platform";
import { configurePlatformForToken } from "@/lib/chrysty/platform";

export async function getServerUserId(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers and RSC only read the session here.
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  configurePlatformForToken(session.access_token);

  try {
    const user = await auth.getUser();
    return user.id;
  } catch {
    return null;
  }
}
