import { getSessionUser } from "@/lib/auth";
export async function GET() {
  const user = await getSessionUser();
  return user ? Response.json({ user }) : Response.json({ error: "Sin sesión" }, { status: 401 });
}
