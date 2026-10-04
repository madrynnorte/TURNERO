import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export async function POST(request: Request) {
  const payload = await request.json() as { username?: string; password?: string };
  const username = payload.username?.trim().toLowerCase() ?? "";
  const password = payload.password ?? "";
  if (!username || !password) return Response.json({ error: "Ingresá usuario y contraseña" }, { status: 400 });
  await ensureSeedData();
  const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
  if (!user?.active || !(await verifyPassword(password, user.passwordHash, user.passwordSalt))) {
    return Response.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }
  await createSession(user.id, new URL(request.url).protocol === "https:");
  return Response.json({ user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, mustChangePassword: user.mustChangePassword } });
}
