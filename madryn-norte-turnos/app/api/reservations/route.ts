import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, bookingTypes, reservationSlots, reservations } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

function buildSlots(start: string, end: string) {
  const startMs = Date.parse(start); const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || startMs % 1800000 !== 0 || endMs % 1800000 !== 0) return null;
  const slots = []; for (let time = startMs; time < endMs; time += 1800000) slots.push(new Date(time).toISOString());
  return slots.length > 16 ? null : slots;
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["administrador", "encargado"]); if ("error" in auth) return auth.error;
  const payload = await request.json() as Record<string, unknown>;
  const clientName = String(payload.clientName ?? "").trim(); const courtId = String(payload.courtId ?? ""); const bookingTypeId = String(payload.bookingTypeId ?? "");
  const startsAt = String(payload.startsAt ?? ""); const endsAt = String(payload.endsAt ?? ""); const slots = buildSlots(startsAt, endsAt);
  if (!clientName || !courtId || !bookingTypeId || !slots) return Response.json({ error: "Revisá cliente, cancha y horario. Los turnos deben usar intervalos de 30 minutos." }, { status: 400 });
  const status = String(payload.status ?? "pendiente");
  if (!['pendiente', 'confirmado', 'cancelado'].includes(status)) return Response.json({ error: "Estado inválido" }, { status: 400 });
  const db = getDb();
  if (status !== "cancelado") {
    const conflict = await db.select({ id: reservationSlots.id }).from(reservationSlots).where(and(eq(reservationSlots.courtId, courtId), inArray(reservationSlots.slotAt, slots))).limit(1);
    if (conflict.length) return Response.json({ error: "La cancha ya está ocupada en parte de ese horario." }, { status: 409 });
  }
  const [type] = await db.select().from(bookingTypes).where(eq(bookingTypes.id, bookingTypeId)).limit(1);
  if (!type) return Response.json({ error: "Tipo de turno inválido" }, { status: 400 });
  const paymentMode = String(payload.paymentMode ?? "por_encuentro");
  const listPrice = paymentMode === "mensual" ? 0 : Number(payload.listPrice ?? type.suggestedPrice ?? 0); const discountValue = Math.max(0, Number(payload.discountValue ?? 0)); const discountType = String(payload.discountType ?? "none");
  const finalPrice = Math.max(0, discountType === "percent" ? listPrice * (1 - Math.min(100, discountValue) / 100) : listPrice - (discountType === "amount" ? discountValue : 0));
  const id = crypto.randomUUID();
  const row = { id, clientName, phone: String(payload.phone ?? ""), courtId, bookingTypeId, startsAt, endsAt, status, color: String(payload.color ?? type.color), notes: String(payload.notes ?? ""), paymentMode, listPrice, discountType, discountValue, discountReason: String(payload.discountReason ?? ""), finalPrice, responsibleId: payload.responsibleId ? String(payload.responsibleId) : null, seriesId: payload.seriesId ? String(payload.seriesId) : (paymentMode === "mensual" ? `series-${crypto.randomUUID()}` : null), createdBy: auth.user.id };
  try {
    await db.insert(reservations).values(row);
    if (status !== "cancelado") await db.insert(reservationSlots).values(slots.map((slotAt) => ({ id: crypto.randomUUID(), reservationId: id, courtId, slotAt })));
  } catch {
    await db.delete(reservations).where(eq(reservations.id, id));
    return Response.json({ error: "Otro usuario ocupó ese horario. Actualizá la agenda e intentá nuevamente." }, { status: 409 });
  }
  await db.insert(auditLog).values({ id: crypto.randomUUID(), entityType: "reservation", entityId: id, action: "create", afterJson: JSON.stringify(row), userId: auth.user.id });
  return Response.json({ reservation: row }, { status: 201 });
}
