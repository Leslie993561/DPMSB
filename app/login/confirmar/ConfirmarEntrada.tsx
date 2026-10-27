"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ConfirmarEntrada() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/auth/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Não foi possível confirmar.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-3">
      <p className="text-[12px] text-foreground-muted">Clique para concluir a sua entrada no portal.</p>
      {erro && <p className="rounded-md bg-status-danger/10 px-3 py-2 text-[12px] text-status-danger">{erro}</p>}
      <button
        type="button"
        disabled={enviando || !token}
        onClick={() => void confirmar()}
        className="rounded-md bg-brand-primary px-3 py-2 text-[13px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800 disabled:opacity-60"
      >
        {enviando ? "Confirmando…" : "Confirmar entrada"}
      </button>
      <a href="/login" className="text-center text-[11.5px] text-brand-primary hover:underline">
        Voltar para a tela de entrada
      </a>
    </div>
  );
}
