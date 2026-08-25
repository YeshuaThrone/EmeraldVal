"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Shield } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Sign-in failed.");
        return;
      }
      router.replace("/admin/data-room");
      router.refresh();
    } catch {
      setError("Could not reach the admin service.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-dvh items-center justify-center overflow-y-auto bg-[#F8FAFC] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-[#00529C]/20 bg-white p-6 shadow-lg"
      >
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[#E0144C] uppercase">
          <Shield className="h-3.5 w-3.5" />
          Super-admin
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-[#003366]">
          ATX Live Data Room
        </h1>
        <p className="mt-1 text-sm text-[#00529C]/80">
          JWT-protected municipal and Luminate metrics. Map UI is unchanged.
        </p>

        <label className="mt-6 grid gap-1.5">
          <span className="text-xs font-medium text-[#00529C]">Admin password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-[#00529C]/30 bg-white px-3 py-2.5 text-sm text-[#003366] outline-none focus:border-[#00529C] focus:ring-2 focus:ring-[#00529C]/20"
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-xl border border-[#E0144C]/30 bg-[#E0144C]/5 px-3 py-2 text-sm text-[#E0144C]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E0144C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#c41243] disabled:opacity-70"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          Enter Data Room
        </button>
      </form>
    </div>
  );
}
