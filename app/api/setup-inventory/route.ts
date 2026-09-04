import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

/**
 * Ya no ejecuta DDL. El esquema debe venir de migraciones
 * (scripts/16_locations_active_and_inventory.sql y anteriores).
 * Solo limpia stock negativo si las columnas existen.
 */
export async function POST(_request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
      await sql`UPDATE products SET stock = 0 WHERE stock < 0`;
    } catch {
      return NextResponse.json(
        {
          error:
            "Falta el esquema de inventario. Ejecuta en Neon: scripts/16_locations_active_and_inventory.sql (y migraciones de stock_movements si aplica).",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message:
        "Stock negativo corregido. El esquema no se modifica desde la API; usa los scripts SQL de migración.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
