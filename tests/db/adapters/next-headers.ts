import { AsyncLocalStorage } from "node:async_hooks";

/** Cookies por petición (cada llamada a una ruta corre en su propio contexto). */
const KEY = Symbol.for("barmanager.requestContext");
export type RequestCtx = { cookies: Map<string, string> };
export const requestContext: AsyncLocalStorage<RequestCtx> =
  ((globalThis as any)[KEY] ||= new AsyncLocalStorage<RequestCtx>());

export async function cookies() {
  const jar = requestContext.getStore()?.cookies ?? new Map<string, string>();
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  };
}
