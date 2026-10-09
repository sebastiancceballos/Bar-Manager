import { NextRequest, NextResponse } from "next/server";
import { apiT } from "@/lib/api-i18n";

/** Clave pública VAPID para que el cliente suscriba Web Push. */
export async function GET(request: NextRequest) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { error: apiT(request, "apiPushNotConfigured") },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey: key });
}
