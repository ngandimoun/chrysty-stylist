import { NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  signStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const bucket = searchParams.get("bucket") ?? STORAGE_BUCKETS.uploads;

  if (!path) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const signedUrl = await signStoragePath(bucket, path);
    return NextResponse.json({ signedUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sign failed" },
      { status: 400 }
    );
  }
}
