import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, sessions, users } from "@/db/schema";
import { createSession, hashPassword, requireApiUser, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null) as { currentPassword?: string; newPassword?: string } | null;
  if (!body?.currentPassword || !body.newPassword) return Response.json({ error: "Completá ambas contraseñas" }, { status: 400 });
  if (body.newPassword.length < 10 || !/[A-Z]/.test(body.newPassword) || !/[a-z]/.test(body.newPassword) || !/\d/.test(body.newPassword)) {
    return Response.json({ error: "La nueva clave debe tener al menos 10 caracteres, mayúscula, minúscula y número" }, { status: 400 });
  }
  if (body.currentPassword === body.newPassword) return Response.json({ error: "La nueva clave debe ser diferente" }, { status: 400 });

  const db = getDb();
  const [record] = await db.select({ passwordHash: users.passwordHash, passwordSalt: users.passwordSalt }).from(users).where(eq(users.id, auth.user.id)).limit(1);
  if (!record || !(await verifyPassword(body.currentPassword, record.passwordHash, record.passwordSalt))) {
    return Response.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }

  const credentials = await hashPassword(body.newPassword);
  await db.update(users).set({ passwordHash: credentials.hash, passwordSalt: credentials.salt, mustChangePassword: false }).where(eq(users.id, auth.user.id));
  await db.delete(sessions).where(eq(sessions.userId, auth.user.id));
  await db.insert(auditLog).values({ id: crypto.randomUUID(), entityType: "user", entityId: auth.user.id, action: "password_changed", userId: auth.user.id });
  await createSession(auth.user.id, new URL(request.url).protocol === "https:");
  return Response.json({ ok: true });
}
