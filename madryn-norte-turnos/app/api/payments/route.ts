import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, payments } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
export async function POST(request: Request) {
  const auth = await requireApiUser(["administrador", "encargado"]); if ("error" in auth) return auth.error;
  const payload = await request.json() as Record<string, unknown>; const amount = Number(payload.amount ?? 0);
  if (!(amount > 0) || (!payload.reservationId && !payload.seriesId)) return Response.json({ error: "Indicá el importe y la reserva o abono." }, { status: 400 });
  if (payload.seriesId && !payload.period) return Response.json({ error: "Indicá el período del abono." }, { status: 400 });
  const row = { id: crypto.randomUUID(), reservationId: payload.reservationId ? String(payload.reservationId) : null, seriesId: payload.seriesId ? String(payload.seriesId) : null, period: payload.period ? String(payload.period) : null, amount, method: String(payload.method ?? "efectivo"), paidAt: String(payload.paidAt ?? new Date().toISOString()), notes: String(payload.notes ?? ""), createdBy: auth.user.id };
  const db = getDb();
  if (row.seriesId && row.period) { const [existing] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.seriesId, row.seriesId), eq(payments.period, row.period))).limit(1); if (existing) return Response.json({ error: "Ese abono ya tiene un pago registrado para el período." }, { status: 409 }); }
  await db.insert(payments).values(row); await db.insert(auditLog).values({ id: crypto.randomUUID(), entityType: "payment", entityId: row.id, action: "create", afterJson: JSON.stringify(row), userId: auth.user.id });
  return Response.json({ payment: row }, { status: 201 });
}
