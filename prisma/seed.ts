import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a default location
  const location = await prisma.location.upsert({
    where: { id: "loc_default" },
    update: {},
    create: {
      id: "loc_default",
      name: "Sucursal Principal",
      address: "Calle Principal 123",
    },
  });

  console.log("Created location:", location);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@barmanager.com" },
    update: {},
    create: {
      email: "admin@barmanager.com",
      password: hashedPassword,
      name: "Admin",
      role: "admin",
    },
  });

  console.log("Created admin user:", adminUser);

  // Create demo waiter
  const waiterPassword = await bcrypt.hash("waiter123", 10);
  const waiterUser = await prisma.user.upsert({
    where: { email: "waiter@barmanager.com" },
    update: {},
    create: {
      email: "waiter@barmanager.com",
      password: waiterPassword,
      name: "Mesero Demo",
      role: "waiter",
    },
  });

  console.log("Created waiter user:", waiterUser);

  // Create sample tables
  const tableIds = [];
  for (let i = 1; i <= 6; i++) {
    const table = await prisma.table.create({
      data: {
        locationId: location.id,
        number: i,
        seats: 4,
        x: (i - 1) * 150 + 50,
        y: 50,
      },
    });
    tableIds.push(table.id);
  }

  console.log("Created tables");

  // Create sample products
  const categoryMap: Record<string, string[]> = {
    bebidas: ["Cerveza", "Vino Tinto", "Vino Blanco", "Whisky", "Ron"],
    comidas: ["Tacos", "Enchiladas", "Quesadillas", "Ceviche"],
    postres: ["Flan", "Churros", "Helado"],
  };

  const priceMap: Record<string, number> = {
    bebidas: 45,
    comidas: 120,
    postres: 35,
  };

  for (const [category, items] of Object.entries(categoryMap)) {
    for (const item of items) {
      await prisma.product.create({
        data: {
          locationId: location.id,
          name: item,
          category,
          price: priceMap[category],
        },
      });
    }
  }

  console.log("Created products");

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
