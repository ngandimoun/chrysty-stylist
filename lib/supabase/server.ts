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
        // RSC reads only; middleware refreshes auth cookies on the response.
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  configurePlatformForToken(session.access_token);

  try {
    const platformUser = await auth.getUser();
    return platformUser.id;
  } catch {
    return user.id;
  }
}
