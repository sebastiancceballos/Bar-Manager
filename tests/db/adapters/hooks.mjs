// Redirige, solo durante las pruebas, la base de datos y next/headers a los adaptadores,
// sin importar cómo se importen (alias "@/lib/db" o relativo "./db").
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.PROJECT_ROOT;
const url = (f) => pathToFileURL(join(here, f)).href;
const DB = url("db.ts");
const POOL = url("db-pool.ts");
const HEADERS = url("next-headers.ts");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers") return { url: HEADERS, shortCircuit: true };
  const resolved = await nextResolve(specifier, context);
  if (root && resolved.url.startsWith("file:")) {
    const p = fileURLToPath(resolved.url);
    if (p === join(root, "lib", "db.ts")) return { url: DB, shortCircuit: true };
    if (p === join(root, "lib", "db-pool.ts")) return { url: POOL, shortCircuit: true };
  }
  return resolved;
}
