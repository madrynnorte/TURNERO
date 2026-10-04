import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courts, payments, reservations, staff, users, workLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(request: Request) {
  const auth = await requireApiUser(); if ("error" in auth) return auth.error;
  const kind = new URL(request.url).searchParams.get("kind") ?? "reservations"; const db = getDb(); let rows: unknown[][]; let name: string;
  if (kind === "payments") { const data = await db.select().from(payments).orderBy(asc(payments.paidAt)); rows = [["Fecha", "Importe", "Medio", "Reserva", "Serie", "Período", "Notas"], ...data.map((r) => [r.paidAt, r.amount, r.method, r.reservationId, r.seriesId, r.period, r.notes])]; name = "cobros"; }
  else if (kind === "staff") { const data = await db.select({ person: staff.name, startsAt: workLogs.startsAt, endsAt: workLogs.endsAt, functionName: workLogs.functionName, reservationId: workLogs.reservationId, notes: workLogs.notes }).from(workLogs).innerJoin(staff, eq(staff.id, workLogs.staffId)).orderBy(asc(workLogs.startsAt)); rows = [["Persona", "Entrada", "Salida", "Horas", "Función", "Reserva", "Notas"], ...data.map((r) => [r.person, r.startsAt, r.endsAt, ((Date.parse(r.endsAt) - Date.parse(r.startsAt)) / 3600000).toFixed(2), r.functionName, r.reservationId, r.notes])]; name = "horas-personal"; }
  else { const data = await db.select({ client: reservations.clientName, court: courts.name, startsAt: reservations.startsAt, endsAt: reservations.endsAt, status: reservations.status, listPrice: reservations.listPrice, finalPrice: reservations.finalPrice, source: reservations.source, createdBy: users.displayName }).from(reservations).innerJoin(courts, eq(courts.id, reservations.courtId)).innerJoin(users, eq(users.id, reservations.createdBy)).orderBy(asc(reservations.startsAt)); rows = [["Cliente", "Cancha", "Inicio", "Fin", "Estado", "Precio lista", "Importe final", "Origen", "Cargado por"], ...data.map((r) => [r.client, r.court, r.startsAt, r.endsAt, r.status, r.listPrice, r.finalPrice, r.source, r.createdBy])]; name = "reservas"; }
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
}
