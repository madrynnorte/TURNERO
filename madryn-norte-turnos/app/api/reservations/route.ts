import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLog,
  bookingTypes,
  reservationSlots,
  reservations,
} from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

function buildSlots(start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs ||
    startMs % 1800000 !== 0 ||
    endMs % 1800000 !== 0
  )
    return null;
  const slots = [];
  for (let time = startMs; time < endMs; time += 1800000)
    slots.push(new Date(time).toISOString());
  return slots.length > 16 ? null : slots;
}

export async function POST(request: Request) {
  const auth = await requireApiUser(["administrador", "encargado"]);
  if ("error" in auth) return auth.error;
  const payload = (await request.json()) as Record<string, unknown>;
  const clientName = String(payload.clientName ?? "").trim();
  const courtId = String(payload.courtId ?? "");
  const bookingTypeId = String(payload.bookingTypeId ?? "");
  const startsAt = String(payload.startsAt ?? "");
  const endsAt = String(payload.endsAt ?? "");
  const firstSlots = buildSlots(startsAt, endsAt);
  if (!clientName || !courtId || !bookingTypeId || !firstSlots)
    return Response.json(
      {
        error:
          "Revisá cliente, cancha y horario. Los turnos deben usar intervalos de 30 minutos.",
      },
      { status: 400 },
    );
  const status = String(payload.status ?? "pendiente");
  if (!["pendiente", "confirmado", "cancelado"].includes(status))
    return Response.json({ error: "Estado inválido" }, { status: 400 });

  const db = getDb();
  const [type] = await db
    .select()
    .from(bookingTypes)
    .where(eq(bookingTypes.id, bookingTypeId))
    .limit(1);
  if (!type)
    return Response.json({ error: "Tipo de turno inválido" }, { status: 400 });

  const paymentMode = String(payload.paymentMode ?? "por_encuentro");
  const listPrice =
    paymentMode === "mensual"
      ? 0
      : Number(payload.listPrice ?? type.suggestedPrice ?? 0);
  const discountValue = Math.max(0, Number(payload.discountValue ?? 0));
  const discountType = String(payload.discountType ?? "none");
  const finalPrice = Math.max(
    0,
    discountType === "percent"
      ? listPrice * (1 - Math.min(100, discountValue) / 100)
      : listPrice - (discountType === "amount" ? discountValue : 0),
  );
  const repeatWeekly =
    bookingTypeId === "type-fixed" && payload.repeatWeekly === true;
  const requestedRepeatDate = Date.parse(
    `${String(payload.repeatUntil ?? "")}T23:59:59-03:00`,
  );
  const repeatUntil = Number.isFinite(requestedRepeatDate)
    ? requestedRepeatDate
    : Date.parse(startsAt) + 364 * 86400000;
  const seriesId = repeatWeekly
    ? `series-${crypto.randomUUID()}`
    : payload.seriesId
      ? String(payload.seriesId)
      : paymentMode === "mensual"
        ? `series-${crypto.randomUUID()}`
        : null;

  const occurrences: { startsAt: string; endsAt: string; slots: string[] }[] =
    [];
  const duration = Date.parse(endsAt) - Date.parse(startsAt);
  for (let index = 0; index < (repeatWeekly ? 54 : 1); index += 1) {
    const occurrenceStart = Date.parse(startsAt) + index * 7 * 86400000;
    if (index > 0 && occurrenceStart > repeatUntil) break;
    const occurrenceStartsAt = new Date(occurrenceStart).toISOString();
    const occurrenceEndsAt = new Date(occurrenceStart + duration).toISOString();
    const slots = buildSlots(occurrenceStartsAt, occurrenceEndsAt);
    if (slots)
      occurrences.push({
        startsAt: occurrenceStartsAt,
        endsAt: occurrenceEndsAt,
        slots,
      });
  }

  const created = [];
  const skipped: string[] = [];
  for (const occurrence of occurrences) {
    if (status !== "cancelado") {
      const conflict = await db
        .select({ id: reservationSlots.id })
        .from(reservationSlots)
        .where(
          and(
            eq(reservationSlots.courtId, courtId),
            inArray(reservationSlots.slotAt, occurrence.slots),
          ),
        )
        .limit(1);
      if (conflict.length) {
        skipped.push(occurrence.startsAt);
        continue;
      }
    }
    const id = crypto.randomUUID();
    const row = {
      id,
      clientName,
      phone: String(payload.phone ?? ""),
      courtId,
      bookingTypeId,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      status,
      color: String(payload.color ?? type.color),
      notes: String(payload.notes ?? ""),
      paymentMode,
      listPrice,
      discountType,
      discountValue,
      discountReason: String(payload.discountReason ?? ""),
      finalPrice,
      responsibleId: payload.responsibleId
        ? String(payload.responsibleId)
        : null,
      seriesId,
      createdBy: auth.user.id,
    };
    try {
      await db.insert(reservations).values(row);
      if (status !== "cancelado")
        await db.insert(reservationSlots).values(
          occurrence.slots.map((slotAt) => ({
            id: crypto.randomUUID(),
            reservationId: id,
            courtId,
            slotAt,
          })),
        );
      await db.insert(auditLog).values({
        id: crypto.randomUUID(),
        entityType: "reservation",
        entityId: id,
        action: repeatWeekly ? "create-series" : "create",
        afterJson: JSON.stringify(row),
        userId: auth.user.id,
      });
      created.push(row);
    } catch {
      await db
        .delete(reservationSlots)
        .where(eq(reservationSlots.reservationId, id));
      await db.delete(reservations).where(eq(reservations.id, id));
      skipped.push(occurrence.startsAt);
    }
  }

  if (!created.length)
    return Response.json(
      { error: "Ese horario ya está ocupado en la cancha seleccionada." },
      { status: 409 },
    );
  return Response.json(
    {
      reservation: created[0],
      reservations: created,
      createdCount: created.length,
      skipped,
    },
    { status: 201 },
  );
}
