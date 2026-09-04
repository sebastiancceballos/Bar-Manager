import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { assertOwnsProduct } from "@/lib/tenant";
import { sql } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    const guard = await assertOwnsProduct(productId, user);
    if (guard.error) return guard.error;


    const movements = await sql`
      SELECT * FROM stock_movements 
      WHERE product_id = ${parseInt(id)}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ movements });
  } catch (error) {
    console.error("Get history error:", error);
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}
