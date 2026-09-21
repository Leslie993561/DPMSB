"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Não foi possível entrar.");
        return;
      }
      const proximo = searchParams.get("proximo");
      router.replace(proximo && proximo.startsWith("/") ? proximo : "/dashboard");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[10.5px] font-semibold text-foreground-muted uppercase">E-mail corporativo</label>
        <input
          autoFocus
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@msbbrasil.com"
          className="rounded-md border border-hairline bg-background px-3 py-2 text-[13px] text-foreground"
        />
      </div>

      {erro && <p className="rounded-md bg-status-danger/10 px-3 py-2 text-[12px] text-status-danger">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-md bg-brand-primary px-3 py-2 text-[13px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800 disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
