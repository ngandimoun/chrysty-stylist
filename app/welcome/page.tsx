import { redirect } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { WelcomePage } from "@/components/welcome/welcome-page";
import { SetupRequired } from "@/components/setup/setup-required";
import { getWorkspaceFromCookie } from "@/lib/workspace/session";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { getServerUserId } from "@/lib/supabase/server";

export default async function WelcomeRoute() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const workspace = await getWorkspaceFromCookie();
  if (!workspace) {
    const userId = await getServerUserId();
    if (userId) {
      redirect("/api/workspace/sync?returnTo=/welcome");
    }
  } else {
    redirect("/");
  }

  return (
    <AuthGuard>
      <WelcomePage />
    </AuthGuard>
  );
}
