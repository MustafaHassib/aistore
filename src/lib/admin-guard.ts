import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./session";

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySession(token) !== null;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
}
