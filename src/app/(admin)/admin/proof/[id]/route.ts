import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { isAdmin } from "@/lib/admin-guard";
import { getProof } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 401 before any lookup: an unauthenticated caller learns nothing about
  // which order ids exist.
  if (!(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const db = await getDb();
  const [row] = await db
    .select({ proofKey: orders.proofKey })
    .from(orders)
    .where(eq(orders.id, id));

  if (!row) return new Response("Not found", { status: 404 });

  const bytes = await getProof(row.proofKey);
  if (!bytes) return new Response("Not found", { status: 404 });

  const extension = row.proofKey.split(".").pop() ?? "png";

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      // Customer bank details: never cached by a shared proxy.
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
