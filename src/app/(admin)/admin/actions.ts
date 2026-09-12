"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  signSession,
  verifyPassword,
} from "@/lib/session";
import { requireAdmin } from "@/lib/admin-guard";

export type LoginState = { error?: string };

export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // The same limiter the order endpoint uses, so the single shared password
  // cannot be brute-forced.
  if (!(await checkRateLimit("admin-login", 10, 15 * 60 * 1000))) {
    return { error: "Too many attempts. Try again later." };
  }

  const password = String(formData.get("password") ?? "");
  const stored = process.env.ADMIN_PASSWORD_HASH;

  if (!stored) return { error: "Admin access is not configured." };
  if (!(await verifyPassword(password, stored))) {
    return { error: "Incorrect password." };
  }

  (await cookies()).set(SESSION_COOKIE, signSession({ sub: "admin" }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  redirect("/admin/orders");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin");
}

export async function setStatus(id: string, status: string): Promise<void> {
  await requireAdmin();

  if (!["pending", "confirmed", "rejected"].includes(status)) return;

  const db = await getDb();
  await db.update(orders).set({ status }).where(eq(orders.id, id));
  revalidatePath("/admin/orders");
}
