import { getDb } from "@/db";
import { auditLog, workLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
export async function POST(request: Request) {
  const auth = await requireApiUser(["administrador", "encargado"]); if ("error" in auth) return auth.error;
  const payload = await request.json() as Record<string, unknown>; const startsAt = String(payload.startsAt ?? ""); const endsAt = String(payload.endsAt ?? "");
  if (!payload.staffId || !startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return Response.json({ error: "Revisá persona, entrada y salida." }, { status: 400 });
  const row = { id: crypto.randomUUID(), reservationId: payload.reservationId ? String(payload.reservationId) : null, staffId: String(payload.staffId), startsAt, endsAt, functionName: String(payload.functionName ?? "Otra"), notes: String(payload.notes ?? ""), createdBy: auth.user.id };
  await getDb().insert(workLogs).values(row); await getDb().insert(auditLog).values({ id: crypto.randomUUID(), entityType: "work_log", entityId: row.id, action: "create", afterJson: JSON.stringify(row), userId: auth.user.id });
  return Response.json({ workLog: row }, { status: 201 });
}
