import { NextResponse } from "next/server";
import { defaultChatModel, publicModelList } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ models: publicModelList(), defaultModel: defaultChatModel()?.id ?? null });
}
