import { getDb } from "@/db";
import { bookingTypes, courts, payments, reservationSlots, reservations, staff, users, workLogs } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

const initialUsers = [
  ["user-admin", "admin", "Administrador", "administrador"],
  ["user-encargado-1", "encargado1", "Encargado 1", "encargado"],
  ["user-encargado-2", "encargado2", "Encargado 2", "encargado"],
  ["user-consulta", "consulta", "Consulta", "consulta"],
] as const;

export async function ensureSeedData() {
  const db = getDb();
  for (const [id, username, displayName, role] of initialUsers) {
    const credentials = await hashPassword("Madryn2026!");
    await db.insert(users).values({ id, username, displayName, role, passwordHash: credentials.hash, passwordSalt: credentials.salt, mustChangePassword: true }).onConflictDoNothing();
  }
  await db.insert(courts).values([
    { id: "court-main", name: "Cancha principal", color: "#0c6b58" },
    { id: "court-multi", name: "Cancha multideporte", color: "#1d78b5" },
  ]).onConflictDoNothing();
  await db.insert(bookingTypes).values([
    { id: "type-rental", name: "Alquiler habitual", color: "#dcebf9", defaultMinutes: 60 },
    { id: "type-fixed", name: "Turno fijo", color: "#d9f0e2", defaultMinutes: 60 },
    { id: "type-birthday", name: "Cumpleaños", color: "#eee6fb", defaultMinutes: 240 },
    { id: "type-tournament", name: "Torneo", color: "#d9f0e2", defaultMinutes: 180 },
    { id: "type-training", name: "Escuela o entrenamiento", color: "#dff3f1", defaultMinutes: 90 },
    { id: "type-event", name: "Evento especial", color: "#fee6d8", defaultMinutes: 180 },
    { id: "type-block", name: "Bloqueo interno", color: "#e5e7eb", defaultMinutes: 60 },
    { id: "type-other", name: "Otro", color: "#fff0d7", defaultMinutes: 60 },
  ]).onConflictDoNothing();
  await db.insert(staff).values([
    { id: "staff-juan", name: "Juan" }, { id: "staff-maria", name: "María" },
    { id: "staff-lucia", name: "Lucía" }, { id: "staff-tomas", name: "Tomás" },
  ]).onConflictDoNothing();
  const sampleReservations = [
    { id: "sample-banfield", clientName: "Banfield", courtId: "court-main", bookingTypeId: "type-fixed", startsAt: "2026-10-05T22:00:00.000Z", endsAt: "2026-10-05T23:00:00.000Z", status: "confirmado", color: "#dcebf9", paymentMode: "por_encuentro", listPrice: 28000, finalPrice: 28000 },
    { id: "sample-torneo", clientName: "Torneo +30", courtId: "court-main", bookingTypeId: "type-tournament", startsAt: "2026-10-05T23:30:00.000Z", endsAt: "2026-10-06T01:00:00.000Z", status: "confirmado", color: "#d9f0e2", paymentMode: "por_encuentro", listPrice: 35000, finalPrice: 35000 },
    { id: "sample-arqueros", clientName: "Arqueros Tomi", courtId: "court-main", bookingTypeId: "type-training", startsAt: "2026-10-06T21:00:00.000Z", endsAt: "2026-10-06T22:00:00.000Z", status: "confirmado", color: "#dff3f1", paymentMode: "bonificado", listPrice: 0, finalPrice: 0 },
    { id: "sample-lisiadas", clientName: "Las Lisiadas FC", courtId: "court-main", bookingTypeId: "type-fixed", startsAt: "2026-10-07T21:00:00.000Z", endsAt: "2026-10-07T22:00:00.000Z", status: "pendiente", color: "#fff0d7", paymentMode: "mensual", listPrice: 0, finalPrice: 0, seriesId: "series-lisiadas" },
    { id: "sample-mauricio", clientName: "Mauricio", courtId: "court-main", bookingTypeId: "type-fixed", startsAt: "2026-10-07T23:30:00.000Z", endsAt: "2026-10-08T00:30:00.000Z", status: "realizado", color: "#dcebf9", paymentMode: "por_encuentro", listPrice: 25000, finalPrice: 25000 },
    { id: "sample-cumple", clientName: "Cumpleaños Sofía", courtId: "court-main", bookingTypeId: "type-birthday", startsAt: "2026-10-08T22:30:00.000Z", endsAt: "2026-10-09T02:30:00.000Z", status: "confirmado", color: "#eee6fb", paymentMode: "por_encuentro", listPrice: 120000, finalPrice: 120000, responsibleId: "staff-maria" },
    { id: "sample-libre", clientName: "Torneo Libre", courtId: "court-main", bookingTypeId: "type-tournament", startsAt: "2026-10-09T22:00:00.000Z", endsAt: "2026-10-10T01:00:00.000Z", status: "confirmado", color: "#d9f0e2", paymentMode: "por_encuentro", listPrice: 65000, finalPrice: 65000, responsibleId: "staff-juan" },
    { id: "sample-hockey", clientName: "Hockey MN", courtId: "court-main", bookingTypeId: "type-training", startsAt: "2026-10-10T21:00:00.000Z", endsAt: "2026-10-10T22:00:00.000Z", status: "confirmado", color: "#fee6d8", paymentMode: "mensual", listPrice: 0, finalPrice: 0, seriesId: "series-hockey" },
    { id: "sample-basquet", clientName: "Básquet FCN", courtId: "court-multi", bookingTypeId: "type-training", startsAt: "2026-10-11T23:00:00.000Z", endsAt: "2026-10-12T00:00:00.000Z", status: "confirmado", color: "#dff3f1", paymentMode: "mensual", listPrice: 0, finalPrice: 0, seriesId: "series-basquet" },
  ];
  for (const item of sampleReservations) {
    await db.insert(reservations).values({ ...item, phone: "", notes: "Importado del turnero vigente", discountType: "none", discountValue: 0, discountReason: "", createdBy: "user-admin", source: "excel" }).onConflictDoNothing();
    const slots = [];
    for (let time = Date.parse(item.startsAt); time < Date.parse(item.endsAt); time += 30 * 60 * 1000) slots.push({ id: `${item.id}-${time}`, reservationId: item.id, courtId: item.courtId, slotAt: new Date(time).toISOString() });
    await db.insert(reservationSlots).values(slots).onConflictDoNothing();
  }
  await db.insert(payments).values([
    { id: "pay-banfield", reservationId: "sample-banfield", amount: 28000, method: "efectivo", paidAt: "2026-10-05T22:05:00.000Z", createdBy: "user-admin" },
    { id: "pay-mauricio", reservationId: "sample-mauricio", amount: 25000, method: "transferencia", paidAt: "2026-10-07T23:20:00.000Z", createdBy: "user-encargado-1" },
    { id: "pay-cumple-sena", reservationId: "sample-cumple", amount: 40000, method: "mercado_pago", paidAt: "2026-10-01T18:00:00.000Z", notes: "Seña", createdBy: "user-admin" },
    { id: "pay-hockey-oct", seriesId: "series-hockey", period: "2026-10", amount: 95000, method: "transferencia", paidAt: "2026-10-03T15:00:00.000Z", notes: "Abono mensual", createdBy: "user-admin" },
  ]).onConflictDoNothing();
  await db.insert(workLogs).values([
    { id: "work-cumple-maria", reservationId: "sample-cumple", staffId: "staff-maria", startsAt: "2026-10-08T22:00:00.000Z", endsAt: "2026-10-09T01:00:00.000Z", functionName: "Atención de cumpleaños", createdBy: "user-admin" },
    { id: "work-cumple-lucia", reservationId: "sample-cumple", staffId: "staff-lucia", startsAt: "2026-10-08T22:30:00.000Z", endsAt: "2026-10-09T01:30:00.000Z", functionName: "Atención de buffet", createdBy: "user-admin" },
    { id: "work-torneo-juan", reservationId: "sample-libre", staffId: "staff-juan", startsAt: "2026-10-09T21:30:00.000Z", endsAt: "2026-10-10T01:30:00.000Z", functionName: "Organización de torneo", createdBy: "user-admin" },
  ]).onConflictDoNothing();
}
