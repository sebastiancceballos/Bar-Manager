import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // Generate real bcrypt hashes
    const adminHash = await bcrypt.hash("admin123", 10);
    const waiterHash = await bcrypt.hash("waiter123", 10);
    
    console.log("[v0] Generated admin hash:", adminHash);
    console.log("[v0] Generated waiter hash:", waiterHash);
    
    // Update passwords in database
    await sql`UPDATE users SET password_hash = ${adminHash} WHERE email = 'admin@barmanager.com'`;
    await sql`UPDATE users SET password_hash = ${waiterHash} WHERE email = 'waiter@barmanager.com'`;
    
    // Verify the updates
    const users = await sql`SELECT email, password_hash FROM users`;
    
    return NextResponse.json({
      message: "Passwords updated successfully",
      adminHash,
      waiterHash,
      users
    });
  } catch (error) {
    console.error("Error fixing passwords:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
