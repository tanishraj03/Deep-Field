import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { defaultChatModel, publicModelList } from "@/lib/ai/models";

export const dynamic = "force-dynamic";

/** The models, and which ones the signed-in user's keys unlock. */
export async function GET() {
  return withUser(async () => NextResponse.json({ models: publicModelList(), defaultModel: defaultChatModel()?.id ?? null }));
}
