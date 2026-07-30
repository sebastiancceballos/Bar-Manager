// Seed de datos de prueba.
// NOTA: este proyecto NO usa Prisma Client en runtime (ni siquiera está
// instalado en package.json) — toda la app habla con la base de datos vía
// SQL crudo con @neondatabase/serverless (ver lib/db.ts). Este script se
// reescribió para usar el mismo enfoque; antes usaba `PrismaClient`, que
// nunca podía funcionar porque el paquete no existía en node_modules.
//
// Uso:  DATABASE_URL=postgresql://... npx tsx prisma/seed.ts
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("Define DATABASE_URL antes de correr el seed.");
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log("Seeding database...");

  const [location] = await sql`
    INSERT INTO locations (name, address)
    VALUES ('Sucursal Principal', 'Calle Principal 123')
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  const locationId = location?.id ?? (await sql`SELECT id FROM locations WHERE name = 'Sucursal Principal' LIMIT 1`)[0].id;
  console.log("Location:", locationId);

  const adminHash = await bcrypt.hash("admin123", 10);
  await sql`
    INSERT INTO users (email, password_hash, name, role, location_id)
    VALUES ('admin@barmanager.com', ${adminHash}, 'Admin', 'admin', ${locationId})
    ON CONFLICT (email) DO NOTHING
  `;

  const waiterHash = await bcrypt.hash("waiter123", 10);
  await sql`
    INSERT INTO users (email, password_hash, name, role, location_id)
    VALUES ('waiter@barmanager.com', ${waiterHash}, 'Mesero Demo', 'waiter', ${locationId})
    ON CONFLICT (email) DO NOTHING
  `;

  const cashierHash = await bcrypt.hash("cashier123", 10);
  await sql`
    INSERT INTO users (email, password_hash, name, role, location_id)
    VALUES ('cashier@barmanager.com', ${cashierHash}, 'Cajero Demo', 'cashier', ${locationId})
    ON CONFLICT (email) DO NOTHING
  `;

  const kitchenHash = await bcrypt.hash("kitchen123", 10);
  await sql`
    INSERT INTO users (email, password_hash, name, role, location_id)
    VALUES ('kitchen@barmanager.com', ${kitchenHash}, 'Cocina Demo', 'kitchen', ${locationId})
    ON CONFLICT (email) DO NOTHING
  `;
  console.log(
    "Users created (admin@barmanager.com / waiter@barmanager.com / cashier@barmanager.com / kitchen@barmanager.com, " +
      "passwords: admin123 / waiter123 / cashier123 / kitchen123)"
  );

  for (let i = 1; i <= 6; i++) {
    await sql`
      INSERT INTO tables (location_id, table_number, capacity, x_position, y_position)
      VALUES (${locationId}, ${String(i)}, 4, ${(i - 1) * 150 + 50}, 50)
      ON CONFLICT (location_id, table_number) DO NOTHING
    `;
  }
  console.log("Tables created");

  const categoryMap: Record<string, string[]> = {
    bebidas: ["Cerveza", "Vino Tinto", "Vino Blanco", "Whisky", "Ron"],
    comidas: ["Tacos", "Enchiladas", "Quesadillas", "Ceviche"],
    postres: ["Flan", "Churros", "Helado"],
  };
  const priceMap: Record<string, number> = { bebidas: 45, comidas: 120, postres: 35 };

  for (const [category, items] of Object.entries(categoryMap)) {
    for (const item of items) {
      await sql`
        INSERT INTO products (location_id, name, category, price, stock)
        VALUES (${locationId}, ${item}, ${category}, ${priceMap[category]}, 50)
      `;
    }
  }
  console.log("Products created");
  console.log("Seeding complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
