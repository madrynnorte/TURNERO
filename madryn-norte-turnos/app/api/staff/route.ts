import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, staff } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireApiUser(["administrador", "encargado"]);
  if ("error" in auth) return auth.error;
  const payload = (await request.json()) as { name?: string };
  const name = String(payload.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name || name.length > 80)
    return Response.json(
      { error: "Ingresá un nombre de hasta 80 caracteres." },
      { status: 400 },
    );
  const db = getDb();
  const existing = (await db.select().from(staff)).find(
    (person) =>
      person.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"),
  );
  if (existing) {
    if (!existing.active)
      await db
        .update(staff)
        .set({ active: true })
        .where(eq(staff.id, existing.id));
    return Response.json({
      person: { id: existing.id, name: existing.name, active: true },
    });
  }
  const person = { id: `staff-${crypto.randomUUID()}`, name, active: true };
  await db.insert(staff).values(person);
  await db
    .insert(auditLog)
    .values({
      id: crypto.randomUUID(),
      entityType: "staff",
      entityId: person.id,
      action: "create",
      afterJson: JSON.stringify(person),
      userId: auth.user.id,
    });
  return Response.json({ person }, { status: 201 });
}
