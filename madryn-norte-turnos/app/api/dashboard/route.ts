import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingTypes, courts, payments, reservations, staff, workLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? new Date(Date.now() - 7 * 86400000).toISOString();
  const to = url.searchParams.get("to") ?? new Date(Date.now() + 14 * 86400000).toISOString();
  const db = getDb();
  const bookingRows = await db.select({
    id: reservations.id, clientName: reservations.clientName, phone: reservations.phone, courtId: reservations.courtId,
    courtName: courts.name, bookingTypeId: reservations.bookingTypeId, bookingType: bookingTypes.name,
    startsAt: reservations.startsAt, endsAt: reservations.endsAt, status: reservations.status, color: reservations.color,
    notes: reservations.notes, paymentMode: reservations.paymentMode, listPrice: reservations.listPrice,
    discountType: reservations.discountType, discountValue: reservations.discountValue, discountReason: reservations.discountReason,
    finalPrice: reservations.finalPrice, seriesId: reservations.seriesId, version: reservations.version,
  }).from(reservations).innerJoin(courts, eq(courts.id, reservations.courtId)).innerJoin(bookingTypes, eq(bookingTypes.id, reservations.bookingTypeId))
    .where(and(gte(reservations.startsAt, from), lt(reservations.startsAt, to))).orderBy(asc(reservations.startsAt));
  const paymentRows = await db.select().from(payments).where(and(gte(payments.paidAt, from), lt(payments.paidAt, to))).orderBy(asc(payments.paidAt));
  const workRows = await db.select({ id: workLogs.id, reservationId: workLogs.reservationId, staffId: workLogs.staffId, staffName: staff.name, startsAt: workLogs.startsAt, endsAt: workLogs.endsAt, functionName: workLogs.functionName, notes: workLogs.notes })
    .from(workLogs).innerJoin(staff, eq(staff.id, workLogs.staffId)).where(and(gte(workLogs.startsAt, from), lt(workLogs.startsAt, to))).orderBy(asc(workLogs.startsAt));
  const paidByReservation = new Map<string, number>();
  for (const payment of paymentRows) if (payment.reservationId) paidByReservation.set(payment.reservationId, (paidByReservation.get(payment.reservationId) ?? 0) + payment.amount);
  const enriched = bookingRows.map((booking) => ({ ...booking, paid: paidByReservation.get(booking.id) ?? 0, balance: Math.max(0, booking.finalPrice - (paidByReservation.get(booking.id) ?? 0)) }));
  const expected = enriched.filter((item) => item.status !== "cancelado").reduce((sum, item) => sum + item.finalPrice, 0);
  const collected = paymentRows.reduce((sum, item) => sum + item.amount, 0);
  const discounts = enriched.reduce((sum, item) => sum + Math.max(0, item.listPrice - item.finalPrice), 0);
  const reservedHours = enriched.filter((item) => item.status !== "cancelado").reduce((sum, item) => sum + (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 3600000, 0);
  const staffHours = workRows.reduce((sum, item) => sum + (Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 3600000, 0);
  return Response.json({ user: auth.user, reservations: enriched, payments: paymentRows, workLogs: workRows, summary: { expected, collected, pending: Math.max(0, expected - collected), discounts, reservedHours, staffHours } });
}
