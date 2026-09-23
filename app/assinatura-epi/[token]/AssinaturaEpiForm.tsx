"use client";

import { useEffect, useState } from "react";
import { DocumentoFichaEpi } from "@/components/modules/sst/DocumentoFichaEpi";
import type { DocumentoFicha } from "@/lib/sst/fichas";

const INPUT =
  "w-full rounded border border-hairline bg-background px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-brand-primary";

export function AssinaturaEpiForm({ token }: { token: string }) {
  const [documento, setDocumento] = useState<DocumentoFicha | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rg, setRg] = useState("");
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [assinadoAgora, setAssinadoAgora] = useState(false);

  useEffect(() => {
    fetch(`/api/assinatura-epi/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Link inválido.");
        setDocumento(d.documento);
      })
      .catch((e: Error) => setErroCarga(e.message));
  }, [token]);

  async function assinar(ev: React.FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/assinatura-epi/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rg, concordo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não foi possível assinar.");
      setDocumento(d.documento);
      setAssinadoAgora(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível assinar.");
    } finally {
      setEnviando(false);
    }
  }

  if (erroCarga) return <p className="text-[13px] text-status-danger">{erroCarga}</p>;
  if (!documento) return <p className="text-[13px] text-foreground-muted">Carregando...</p>;

  if (assinadoAgora) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-status-success-bg px-3 py-2 text-[13px] font-medium text-status-success">
          Ficha assinada com sucesso. O documento assinado fica guardado no seu histórico com o RH.
        </p>
        <DocumentoFichaEpi documento={documento} />
      </div>
    );
  }

  if (documento.status === "assinada") {
    return <p className="text-[13px] text-foreground">Esta ficha já foi assinada. Obrigado!</p>;
  }
  if (documento.expirada) {
    return <p className="text-[13px] text-status-danger">Este link expirou. Peça ao RH um novo link de assinatura.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <DocumentoFichaEpi documento={documento} />

      <form onSubmit={assinar} className="flex flex-col gap-3 rounded-md border border-hairline p-4">
        <p className="text-[13px] font-semibold text-foreground">Assinar eletronicamente</p>
        <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
          E-mail profissional
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu.nome@msbbrasil.com"
            required
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-foreground-muted">
          RG
          <input value={rg} onChange={(e) => setRg(e.target.value)} placeholder="Número do RG" required className={INPUT} />
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={concordo}
            onChange={(e) => setConcordo(e.target.checked)}
            className="mt-0.5 accent-brand-primary"
          />
          Li a ficha acima, confirmo o recebimento dos EPIs e concordo com a declaração.
        </label>
        {erro && <p className="text-[12px] text-status-danger">{erro}</p>}
        <button
          type="submit"
          disabled={!concordo || enviando}
          className="rounded-md bg-brand-primary px-3 py-2 text-[13px] font-semibold text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {enviando ? "Assinando..." : "Assinar ficha"}
        </button>
      </form>
    </div>
  );
}
