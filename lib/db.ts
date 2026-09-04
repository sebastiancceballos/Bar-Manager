import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL no está configurado. Añádelo en las variables de entorno del servidor (Vercel → Settings → Environment Variables) y vuelve a desplegar."
  );
}

const sql = neon(process.env.DATABASE_URL || "");

export { sql };
