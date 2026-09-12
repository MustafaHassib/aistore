import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { requireAdmin } from "@/lib/admin-guard";
import { logout, setStatus } from "../actions";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-surface-2 text-ink-2",
  confirmed: "bg-success-soft text-success",
  rejected: "bg-surface text-danger",
};

export default async function AdminOrders() {
  await requireAdmin();

  const db = await getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const pending = rows.filter((row) => row.status === "pending").length;

  return (
    <main className="mx-auto max-w-page px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Orders</h1>
          <p className="mt-1 text-sm text-ink-3">
            {rows.length} total · {pending} awaiting review
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="md">
            Sign out
          </Button>
        </form>
      </header>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-ink-3">No orders yet.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-card border-[1.5px] border-line-strong bg-surface p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-ink">
                    {row.reference}
                  </p>
                  <p className="mt-1 text-sm text-ink">{row.name}</p>
                  <p className="text-xs text-ink-2">
                    {row.phone} · {row.email}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {row.amount} EGP · {row.paymentMethod} · {row.offerCode} ·{" "}
                    {row.locale}
                  </p>
                  {row.utmSource ? (
                    <p className="mt-1 text-xs text-ink-3">
                      via {row.utmSource}
                      {row.utmCampaign ? ` / ${row.utmCampaign}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-3">
                    {row.createdAt.toISOString()}
                  </p>
                </div>

                {/* Streams through an authenticated route; the blob key never
                    reaches the browser. */}
                <a
                  href={`/admin/proof/${row.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  {/* next/image is wrong here: the optimizer fetches the
                      source itself and would not carry the admin session
                      cookie, so the proof would 401. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/admin/proof/${row.id}`}
                    alt={`Payment proof for ${row.reference}`}
                    className="h-28 w-28 rounded-card border border-line object-cover"
                  />
                </a>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-control px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[row.status] ?? ""}`}
                >
                  {row.status}
                </span>

                {(["confirmed", "rejected", "pending"] as const)
                  .filter((status) => status !== row.status)
                  .map((status) => (
                    <form
                      key={status}
                      action={async () => {
                        "use server";
                        await setStatus(row.id, status);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="md">
                        Mark {status}
                      </Button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
