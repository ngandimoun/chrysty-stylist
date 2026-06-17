"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/chrysty/ui-copy";

export function WelcomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(t);
  }, []);

  async function getStarted() {
    setLoading(true);
    try {
      await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (showSplash) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="stylist-mark h-16 w-16 text-3xl"
        >
          C
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="stylist-heading text-2xl font-semibold"
        >
          {UI_COPY.welcome.splash}
        </motion.h1>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] space-y-8 text-center"
      >
        <div className="mx-auto flex h-48 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-rose-soft via-background to-accent shadow-md ring-1 ring-border">
          <div className="stylist-mark h-20 w-20 text-4xl">C</div>
          <p className="stylist-heading text-sm font-medium text-muted-foreground">
            {UI_COPY.welcome.splash}
          </p>
        </div>
        <div className="space-y-3">
          <h1 className="stylist-heading text-3xl font-semibold">{UI_COPY.welcome.headline}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{UI_COPY.welcome.subhead}</p>
        </div>
        <Button className="w-full" size="default" disabled={loading} onClick={() => void getStarted()}>
          {loading ? "One moment…" : UI_COPY.welcome.cta}
        </Button>
      </motion.div>
    </div>
  );
}
