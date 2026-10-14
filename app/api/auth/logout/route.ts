import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";
import { apiT } from "@/lib/api-i18n";

export async function POST(request: NextRequest) {
  try {
    await clearAuthCookie();
    return NextResponse.json(
      { message: apiT(request, "apiLoggedOutSuccess") },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: apiT(request, "internalServerError") },
      { status: 500 }
    );
  }
}
