# Tipos y driver Neon

Las consultas con `sql\`...\`` de `@neondatabase/serverless` devuelven filas
tipadas como `Record<string, any>[]`.

## Regla

En callbacks (`.map`, `.filter`, `.every`, `.reduce`, `.find`) **no** anotes el
elemento como objeto literal (`{ id: number }`, `{ paid: boolean }`, etc.).
Eso rompe el build de TypeScript en Vercel.

```ts
// Mal
rows.every((s: { paid: boolean }) => s.paid)
rows.map((o: { id: number }) => o.id)

// Bien
rows.every((s: any) => Boolean(s.paid))
rows.map((o: any) => Number(o.id))
// o: import type { DbRow } from "@/lib/db-types"
```

Ver `lib/db-types.ts`.
