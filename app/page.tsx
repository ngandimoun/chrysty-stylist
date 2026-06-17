import { redirect } from "next/navigation";
import { StylistApp } from "@/components/stylist/stylist-app";
import { SetupRequired } from "@/components/setup/setup-required";
import { getWorkspaceFromCookie } from "@/lib/workspace/session";
import { parseWorkspaceSettings } from "@/lib/workspace/settings";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const workspace = await getWorkspaceFromCookie();
  if (!workspace) {
    redirect("/welcome");
  }

  const settings = parseWorkspaceSettings(workspace.settings);

  return (
    <main className="flex h-svh max-h-svh flex-col overflow-hidden bg-background">
      <StylistApp
        key={workspace.id}
        workspace={{
          id: workspace.id,
          name: workspace.name,
          mission: settings.mission ?? null,
          displayName: workspace.display_name,
          onboardingComplete: workspace.onboarding_complete,
        }}
      />
    </main>
  );
}
