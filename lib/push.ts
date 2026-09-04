import webpush from "web-push";
import { sql } from "./db";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@barmanager.local";
  if (!publicKey || !privateKey) {
    console.warn(
      "[push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY — push desactivado"
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

/** Envía notificación a todas las suscripciones de un pedido. */
export async function notifyOrder(orderId: number, payload: PushPayload): Promise<void> {
  if (!configureVapid()) return;

  let subs: { id: number; endpoint: string; p256dh: string; auth: string }[] = [];
  try {
    subs = (await sql`
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE order_id = ${orderId} AND scope = 'order'
    `) as any;
  } catch (err) {
    console.warn("[push] No se pudieron leer suscripciones (¿migración 11?):", err);
    return;
  }

  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || `order-${orderId}`,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: any) {
        const code = err?.statusCode;
        // 404/410 = suscripción muerta → borrar
        if (code === 404 || code === 410) {
          try {
            await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
          } catch {
            /* ignore */
          }
        } else {
          console.error("[push] Error enviando a", sub.endpoint.slice(0, 40), err);
        }
      }
    })
  );
}

/** Notifica al personal de un bar (scope staff). */
export async function notifyStaff(
  locationId: number,
  payload: PushPayload
): Promise<void> {
  if (!configureVapid()) return;

  let subs: { id: number; endpoint: string; p256dh: string; auth: string }[] = [];
  try {
    subs = (await sql`
      SELECT id, endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE location_id = ${locationId} AND scope = 'staff'
    `) as any;
  } catch (err) {
    console.warn("[push] staff subs:", err);
    return;
  }

  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/dashboard/orders",
    tag: payload.tag || `staff-${locationId}`,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try {
            await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
          } catch {
            /* ignore */
          }
        }
      }
    })
  );
}
