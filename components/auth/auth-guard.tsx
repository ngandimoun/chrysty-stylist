"use client";

import { useEffect, useRef, useState } from "react";
import { getLoginRedirectUrl } from "@/lib/chrysty/constants";
import { useSessionBootstrap } from "@/components/auth/session-bootstrap";

const SESSION_RETRIES = 3;
const SESSION_RETRY_DELAY_MS = 500;

async function verifySession(): Promise<boolean> {
  for (let attempt = 0; attempt < SESSION_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, SESSION_RETRY_DELAY_MS * attempt)
      );
    }

    const response = await fetch("/api/auth/session", { credentials: "include" });
    if (!response.ok) {
      continue;
    }

    const { valid } = (await response.json()) as { valid: boolean };
    if (valid) {
      return true;
    }
  }

  return false;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const checked = useRef(false);
  const bootstrapped = useSessionBootstrap();

  useEffect(() => {
    if (!bootstrapped || checked.current) return;
    checked.current = true;

    const timeout = window.setTimeout(() => {
      setFailed(true);
    }, 12_000);

    verifySession()
      .then((valid) => {
        window.clearTimeout(timeout);
        if (!valid) {
          window.location.replace(getLoginRedirectUrl(window.location.href));
          return;
        }
        setReady(true);
      })
      .catch(() => {
        window.clearTimeout(timeout);
        setFailed(true);
      });

    return () => window.clearTimeout(timeout);
  }, [bootstrapped]);

  if (ready) {
    return <>{children}</>;
  }

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-muted-foreground">
        <p>We couldn&apos;t verify your Chrysty session.</p>
        <a
          href={getLoginRedirectUrl(window.location.href)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in on chrysty.dev
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      Checking your Chrysty session…
    </div>
  );
}
