import { NextResponse } from "next/server";

/** Clave pública VAPID para que el cliente suscriba Web Push. */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Push no configurado (falta NEXT_PUBLIC_VAPID_PUBLIC_KEY)" },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey: key });
}
