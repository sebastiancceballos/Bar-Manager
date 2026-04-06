import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function fixPasswords() {
  try {
    // Generate proper bcrypt hashes
    const adminHash = await bcrypt.hash("admin123", 10);
    const waiterHash = await bcrypt.hash("waiter123", 10);
    
    console.log("Generated admin hash:", adminHash);
    console.log("Generated waiter hash:", waiterHash);
    
    // Update admin password
    await sql`
      UPDATE users 
      SET password_hash = ${adminHash}
      WHERE email = 'admin@barmanager.com'
    `;
    console.log("Updated admin password");
    
    // Update waiter password
    await sql`
      UPDATE users 
      SET password_hash = ${waiterHash}
      WHERE email = 'waiter@barmanager.com'
    `;
    console.log("Updated waiter password");
    
    // Verify users exist
    const users = await sql`SELECT id, email, name, role FROM users`;
    console.log("Users in database:", users);
    
    console.log("Passwords updated successfully!");
  } catch (error) {
    console.error("Error updating passwords:", error);
    process.exit(1);
  }
}

fixPasswords();
