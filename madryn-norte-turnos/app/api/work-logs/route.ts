import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, staff, reservations, workLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
export async function POST(request: Request) {
  const auth = await requireApiUser(["administrador", "encargado"]);
  if ("error" in auth) return auth.error;
  const payload = (await request.json()) as Record<string, unknown>;
  const startsAt = String(payload.startsAt ?? "");
  const endsAt = String(payload.endsAt ?? "");
  if (
    !payload.staffId ||
    !Number.isFinite(Date.parse(startsAt)) ||
    !Number.isFinite(Date.parse(endsAt)) ||
    Date.parse(endsAt) <= Date.parse(startsAt)
  )
    return Response.json(
      { error: "Revisá persona, entrada y salida." },
      { status: 400 },
    );
  const db = getDb();
  const [person] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, String(payload.staffId)), eq(staff.active, true)))
    .limit(1);
  if (!person)
    return Response.json({ error: "Persona inválida" }, { status: 400 });
  if (payload.reservationId) {
    const [booking] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(eq(reservations.id, String(payload.reservationId)))
      .limit(1);
    if (!booking)
      return Response.json({ error: "Reserva inexistente" }, { status: 404 });
    const [duplicate] = await db
      .select({ id: workLogs.id })
      .from(workLogs)
      .where(
        and(
          eq(workLogs.reservationId, String(payload.reservationId)),
          eq(workLogs.staffId, person.id),
          eq(workLogs.startsAt, startsAt),
          eq(workLogs.endsAt, endsAt),
        ),
      )
      .limit(1);
    if (duplicate)
      return Response.json(
        { error: "Esta persona ya tiene esa cobertura registrada." },
        { status: 409 },
      );
  }
  const row = {
    id: crypto.randomUUID(),
    reservationId: payload.reservationId ? String(payload.reservationId) : null,
    staffId: String(payload.staffId),
    startsAt,
    endsAt,
    functionName: String(payload.functionName ?? "Otra"),
    notes: String(payload.notes ?? ""),
    createdBy: auth.user.id,
  };
  await getDb().insert(workLogs).values(row);
  await getDb()
    .insert(auditLog)
    .values({
      id: crypto.randomUUID(),
      entityType: "work_log",
      entityId: row.id,
      action: "create",
      afterJson: JSON.stringify(row),
      userId: auth.user.id,
    });
  return Response.json({ workLog: row }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const reservationId = new URL(request.url).searchParams.get("reservationId");
  if (!reservationId)
    return Response.json({ error: "Falta la reserva" }, { status: 400 });
  const db = getDb();
  const rows = await db
    .select({
      id: workLogs.id,
      reservationId: workLogs.reservationId,
      staffId: workLogs.staffId,
      staffName: staff.name,
      startsAt: workLogs.startsAt,
      endsAt: workLogs.endsAt,
      functionName: workLogs.functionName,
      notes: workLogs.notes,
    })
    .from(workLogs)
    .innerJoin(staff, eq(staff.id, workLogs.staffId))
    .where(eq(workLogs.reservationId, reservationId));
  const people = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(eq(staff.active, true));
  return Response.json({ workLogs: rows, staff: people });
}
