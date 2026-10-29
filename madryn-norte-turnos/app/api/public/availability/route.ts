import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { courts, reservations, reservationSlots } from "@/db/schema";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const from = new Date(url.searchParams.get("from") ?? now.toISOString());
  const to = new Date(url.searchParams.get("to") ?? new Date(now.getTime() + 7 * 86400000).toISOString());

  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    return Response.json({ error: "Rango de fechas inválido." }, { status: 400, headers: PUBLIC_HEADERS });
  }
  if (to.getTime() - from.getTime() > 15 * 86400000) {
    return Response.json({ error: "Se pueden consultar hasta 15 días por vez." }, { status: 400, headers: PUBLIC_HEADERS });
  }

  const db = getDb();
  const [courtRows, occupiedRows] = await Promise.all([
    db.select({ id: courts.id, name: courts.name, color: courts.color })
      .from(courts)
      .where(eq(courts.active, true))
      .orderBy(asc(courts.name)),
    db.select({ courtId: reservationSlots.courtId, slotAt: reservationSlots.slotAt })
      .from(reservationSlots)
      .innerJoin(reservations, eq(reservations.id, reservationSlots.reservationId))
      .where(and(
        gte(reservationSlots.slotAt, from.toISOString()),
        lt(reservationSlots.slotAt, to.toISOString()),
        ne(reservations.status, "cancelado"),
      ))
      .orderBy(asc(reservationSlots.slotAt)),
  ]);

  return Response.json(
    {
      courts: courtRows,
      occupied: occupiedRows,
      opening: { start: "15:00", end: "24:00", slotMinutes: 30, bookingMinutes: 60 },
      generatedAt: new Date().toISOString(),
    },
    { headers: PUBLIC_HEADERS },
  );
}
