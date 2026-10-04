import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, reservationSlots, reservations } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

function slotsFor(start: string, end: string) { const slots = []; for (let time = Date.parse(start); time < Date.parse(end); time += 1800000) slots.push(new Date(time).toISOString()); return slots; }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(["administrador", "encargado"]); if ("error" in auth) return auth.error;
  const { id } = await context.params; const payload = await request.json() as Record<string, unknown>; const db = getDb();
  const [before] = await db.select().from(reservations).where(eq(reservations.id, id)).limit(1); if (!before) return Response.json({ error: "Reserva inexistente" }, { status: 404 });
  const expectedVersion = Number(payload.version ?? before.version); if (expectedVersion !== before.version) return Response.json({ error: "La reserva cambió en otro dispositivo. Actualizá antes de guardar." }, { status: 409 });
  const startsAt = String(payload.startsAt ?? before.startsAt); const endsAt = String(payload.endsAt ?? before.endsAt); const courtId = String(payload.courtId ?? before.courtId); const slots = slotsFor(startsAt, endsAt);
  const conflicts = await db.select({ id: reservationSlots.id }).from(reservationSlots).where(and(eq(reservationSlots.courtId, courtId), inArray(reservationSlots.slotAt, slots), ne(reservationSlots.reservationId, id))).limit(1);
  if (conflicts.length) return Response.json({ error: "La cancha ya está ocupada en ese horario." }, { status: 409 });
  const updates = { clientName: String(payload.clientName ?? before.clientName), startsAt, endsAt, courtId, status: String(payload.status ?? before.status), notes: String(payload.notes ?? before.notes), version: before.version + 1, updatedAt: new Date().toISOString() };
  await db.delete(reservationSlots).where(eq(reservationSlots.reservationId, id)); await db.update(reservations).set(updates).where(eq(reservations.id, id));
  await db.insert(reservationSlots).values(slots.map((slotAt) => ({ id: crypto.randomUUID(), reservationId: id, courtId, slotAt })));
  await db.insert(auditLog).values({ id: crypto.randomUUID(), entityType: "reservation", entityId: id, action: "update", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(updates), userId: auth.user.id });
  return Response.json({ reservation: { ...before, ...updates } });
}
