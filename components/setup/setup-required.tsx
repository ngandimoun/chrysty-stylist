import { getMissingSupabaseEnv, isOpenAIOptional } from "@/lib/config/setup";

export function SetupRequired() {
  const missing = getMissingSupabaseEnv();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
      <div className="stylist-card mx-auto max-w-md space-y-4 text-left">
        <div className="stylist-mark mx-auto">C</div>
        <h1 className="stylist-heading text-center text-xl font-semibold">Almost there</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your Supabase URL and anon key are set, but this app also needs the{" "}
          <strong className="text-foreground">service role key</strong> for server routes
          (workspace, uploads, chat history). It is separate from the anon key.
        </p>
        {missing.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
            {missing.map((key) => (
              <li key={key}>
                <code className="text-foreground">{key}</code>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm leading-relaxed text-muted-foreground">
          In Supabase: <strong className="text-foreground">Project Settings → API → service_role</strong>
          . Add it to <code>.env.local</code> as{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY=...</code>, then restart{" "}
          <code>npm run dev</code>.
        </p>
        {isOpenAIOptional() && (
          <p className="text-xs text-muted-foreground">
            OpenAI is optional for now — chat and outfits use simple fallbacks without it.
          </p>
        )}
      </div>
    </div>
  );
}
