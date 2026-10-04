import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, reservationSlots, reservations } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

function slotsFor(start: string, end: string) { const startMs = Date.parse(start); const endMs = Date.parse(end); if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || startMs % 1800000 !== 0 || endMs % 1800000 !== 0) return null; const slots = []; for (let time = startMs; time < endMs; time += 1800000) slots.push(new Date(time).toISOString()); return slots.length <= 16 ? slots : null; }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(["administrador", "encargado"]); if ("error" in auth) return auth.error;
  const { id } = await context.params; const payload = await request.json() as Record<string, unknown>; const db = getDb();
  const [before] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1); if (!before) return Response.json({ error: "Reserva inexistente" }, { status: 404 });
  const expectedVersion = Number(payload.version ?? before.version); if (expectedVersion !== before.version) return Response.json({ error: "La reserva cambió en otro dispositivo. Actualizá antes de guardar." }, { status: 409 });
  const startsAt = String(payload.startsAt ?? before.startsAt); const endsAt = String(payload.endsAt ?? before.endsAt); const courtId = String(payload.courtId ?? before.courtId); const slots = slotsFor(startsAt, endsAt);
  if (!slots) return Response.json({ error: "Revisá el horario y la duración." }, { status: 400 });
  const status = String(payload.status ?? before.status); if (!["pendiente", "confirmado", "cancelado"].includes(status)) return Response.json({ error: "Estado inválido" }, { status: 400 });
  if (status !== "cancelado") { const conflicts = await db.select({ id: reservationSlots.id }).from(reservationSlots).where(and(eq(reservationSlots.courtId, courtId), inArray(reservationSlots.slotAt, slots), ne(reservationSlots.reservationId, id))).limit(1); if (conflicts.length) return Response.json({ error: "La cancha ya está ocupada en ese horario." }, { status: 409 }); }
  const paymentMode = String(payload.paymentMode ?? before.paymentMode); const listPrice = paymentMode === "mensual" ? 0 : Number(payload.listPrice ?? before.listPrice); const finalPrice = paymentMode === "mensual" ? 0 : Number(payload.finalPrice ?? listPrice);
  const updates = { clientName: String(payload.clientName ?? before.clientName), phone: String(payload.phone ?? before.phone), startsAt, endsAt, courtId, status, color: String(payload.color ?? before.color), notes: String(payload.notes ?? before.notes), paymentMode, listPrice, finalPrice, version: before.version + 1, updatedAt: new Date().toISOString() };
  await db.delete(reservationSlots).where(eq(reservationSlots.reservationId, id)); await db.update(reservations).set(updates).where(eq(reservations.id, id));
  if (status !== "cancelado") await db.insert(reservationSlots).values(slots.map((slotAt) => ({ id: crypto.randomUUID(), reservationId: id, courtId, slotAt })));
  await db.insert(auditLog).values({ id: crypto.randomUUID(), entityType: "reservation", entityId: id, action: "update", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(updates), userId: auth.user.id });
  return Response.json({ reservation: { ...before, ...updates } });
}
