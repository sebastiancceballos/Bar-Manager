// Ejecuta las pruebas apuntando al proyecto indicado.
//   node run.mjs                       -> proyecto actual (../..)
//   PROJECT_ROOT=/ruta/al/otro node run.mjs   -> otro árbol (p. ej. el original)
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.PROJECT_ROOT || join(here, "..", ".."));
const tmp = join(here, ".tmp");
mkdirSync(tmp, { recursive: true });

const tsconfig = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    jsx: "preserve",
    strict: false,
    skipLibCheck: true,
    baseUrl: "/",
    paths: {
      "@/*": [join(root, "*")],
    },
  },
};
const tsconfigPath = join(tmp, "tsconfig.json");
writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));

const filter = process.argv[2];
const files = readdirSync(here)
  .filter((f) => f.endsWith(".test.ts") && (!filter || f.includes(filter)))
  .map((f) => join(here, f));

console.log(`Proyecto probado: ${root}`);
const r = spawnSync(
  process.execPath,
  ["--import", "tsx", "--import", "./register.mjs", "--test", "--test-concurrency=1", ...files],
  {
    cwd: here,
    stdio: "inherit",
    env: {
      ...process.env,
      PROJECT_ROOT: root,
      TSX_TSCONFIG_PATH: tsconfigPath,
      JWT_SECRET: "test-secret-do-not-use",
      NODE_ENV: "test",
    },
  }
);
process.exit(r.status ?? 1);
