/**
 * Crea el Superadmin inicial con contraseña aleatoria (nunca hardcodeada).
 * Uso: DATABASE_URL=... node scripts/create-owner.mjs email@dominio.com "Nombre"
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const email = process.argv[2];
const name = process.argv[3] || "Superadmin";
if (!process.env.DATABASE_URL || !email) {
  console.error("Uso: DATABASE_URL=... node scripts/create-owner.mjs email@dominio.com \"Nombre\"");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const password = crypto.randomBytes(12).toString("base64url");
const hash = await bcrypt.hash(password, 12);

try {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false`;
} catch (_) {}

await sql`
  INSERT INTO users (name, email, password_hash, role, must_change_password)
  VALUES (${name}, ${email}, ${hash}, 'owner', true)
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        must_change_password = true,
        role = 'owner'
`;

console.log("Owner creado/actualizado.");
console.log("Email:", email);
console.log("Contraseña (guárdala ahora, no se volverá a mostrar):", password);
console.log("Debe cambiarse en el primer login (must_change_password=true).");
