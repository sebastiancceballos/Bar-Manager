import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Generate real bcrypt hashes
    const ownerHash = await bcrypt.hash("owner123", 10);
    const adminHash = await bcrypt.hash("admin123", 10);
    const waiterHash = await bcrypt.hash("waiter123", 10);
    
    // Create owner user if doesn't exist
    const existingOwner = await sql`SELECT id FROM users WHERE email = 'owner@barmanager.com' LIMIT 1`;
    if (Array.isArray(existingOwner) && existingOwner.length === 0) {
      await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Platform Owner', 'owner@barmanager.com', ${ownerHash}, 'owner')
      `;
    } else {
      await sql`UPDATE users SET password_hash = ${ownerHash} WHERE email = 'owner@barmanager.com'`;
    }
    
    // Update admin and waiter passwords
    await sql`UPDATE users SET password_hash = ${adminHash} WHERE email = 'admin@barmanager.com'`;
    await sql`UPDATE users SET password_hash = ${waiterHash} WHERE email = 'waiter@barmanager.com'`;
    
    // Verify the updates
    const users = await sql`SELECT id, email, name, role FROM users`;
    
    return NextResponse.json({
      message: "Users and passwords configured successfully",
      users: Array.isArray(users) ? users : [],
      credentials: {
        owner: { email: "owner@barmanager.com", password: "owner123" },
        admin: { email: "admin@barmanager.com", password: "admin123" },
        waiter: { email: "waiter@barmanager.com", password: "waiter123" },
      }
    });
  } catch (error) {
    console.error("Error fixing passwords:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
