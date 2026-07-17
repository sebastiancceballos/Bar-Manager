import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// NOTA: esto ya está cubierto por scripts/06_consolidate_hidden_migrations.sql.
// Se deja como POST (nunca GET, porque esto muta la base de datos y un GET
// puede dispararse por accidente vía prefetch del navegador o un crawler)
// como botón de "reparar" manual por si una base de datos vieja no corrió
// esa migración.
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdminOrOwner = user.role === "admin" || user.role === "owner";
    if (!isAdminOrOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 1. Add stock column to products
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`;
    
    // 1.1 Add owner_id to locations
    await sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id)`;

    // 2. Create stock_movements table
    await sql`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL,
        reason TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 3. Reset negative stock to 0 (Data cleanup)
    await sql`UPDATE products SET stock = 0 WHERE stock < 0`;

    return NextResponse.json({ message: "Base de datos actualizada para inventario y stock corregido" });
  } catch (error) {
    console.error("Setup inventory error:", error);
    return NextResponse.json({ error: "Error actualizando base de datos" }, { status: 500 });
  }
}
