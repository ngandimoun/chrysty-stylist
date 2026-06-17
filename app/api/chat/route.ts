import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { streamStylistChat } from "@/lib/ai/openai";
import { detectChatIntent } from "@/lib/chrysty/chat-intents";
import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import { trackAgentUsage } from "@/lib/chrysty/track-usage";
import { getMemoryJson, updateMemoryFromChat } from "@/lib/memory/service";
import {
  appendMessage,
  getOrCreateConversation,
  getRecentMessages,
} from "@/lib/chat/service";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/workspace/session";
import { listConfirmedWardrobeItems } from "@/lib/wardrobe/service";

const schema = z.object({ message: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAccess(request);

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const { message } = schema.parse(await request.json());

    if (detectChatIntent(message) !== "memory") {
      const lower = message.toLowerCase();
      const wantsOutfit =
        /wear today|outfit|dress for|what should i wear|help me for|look for/i.test(
          lower
        );
      if (wantsOutfit) {
        return NextResponse.json({ redirect: "/api/outfits/generate" }, { status: 202 });
      }
    }

    const wardrobeRows = await listConfirmedWardrobeItems(workspace.id);
    const wardrobeSummary = wardrobeRows
      .map((w) => `- ${w.description} (${w.category})`)
      .join("\n");

    const memoryJson = await getMemoryJson(workspace.id);
    const conversation = await getOrCreateConversation(workspace.id);
    const recent = await getRecentMessages(conversation.id);
    await appendMessage(conversation.id, "user", message, {}, workspace.id);

    const stream = await streamStylistChat({
      messages: [
        ...recent.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
      memoryJson,
      wardrobeSummary,
      userName: workspace.display_name ?? undefined,
    });

    const encoder = new TextEncoder();
    let full = "";

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          full += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          );
        }
        await appendMessage(conversation.id, "assistant", full, {}, workspace.id);
        await updateMemoryFromChat(workspace.id, message);
        try {
          await trackAgentUsage({
            inputTokens: Math.ceil(message.length / 4),
            outputTokens: Math.ceil(full.length / 4),
          });
        } catch (error) {
          console.error("[usage/track] Failed to record usage:", error);
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    if (e instanceof PlatformAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat failed" },
      { status: 500 }
    );
  }
}
