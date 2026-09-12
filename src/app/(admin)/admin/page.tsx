"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const initial: LoginState = {};

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-5">
      <Card className="w-full">
        <h1 className="text-xl font-bold text-ink">Orders admin</h1>
        <p className="mt-1 text-sm text-ink-3">Sign in to review orders.</p>

        <form action={action} className="mt-6 flex flex-col gap-3">
          <label className="text-xs font-semibold text-ink-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent"
          />

          {state?.error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" size="md" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
