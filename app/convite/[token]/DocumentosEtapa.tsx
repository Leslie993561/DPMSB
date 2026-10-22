"use client";

import { useState } from "react";
import {
  ACCEPT_HTML,
  DOCUMENTOS_ESTRANGEIRO,
  DOCUMENTOS_PESSOAIS,
  REGRAS_ANEXO,
  VISTOS,
  type DadosEstrangeiro,
  type DocumentoConvite,
} from "@/lib/convite/documentos";

export interface DocumentoEnviado {
  id: number;
  tipo: string;
  arquivo: string;
}

const INPUT_CLASS =
  "w-full rounded border border-hairline bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-foreground-muted/60";

const ESTRANGEIRO_VAZIO: DadosEstrangeiro = {
  dataNaturalizacao: null,
  casadoComBrasileiro: null,
  filhoComBrasileiro: null,
  visto: null,
};

/** Segunda etapa do link: anexar documentos pessoais. Nenhum é obrigatório — o que falta fica em vermelho. */
export function DocumentosEtapa({
  token,
  expiraEm,
  documentosIniciais,
  estrangeiroInicial,
  onFinalizado,
}: {
  token: string;
  expiraEm: string;
  documentosIniciais: DocumentoEnviado[];
  estrangeiroInicial: DadosEstrangeiro | null;
  onFinalizado: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoEnviado[]>(documentosIniciais);
  const [enviandoChave, setEnviandoChave] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estrangeiro, setEstrangeiro] = useState<DadosEstrangeiro>(estrangeiroInicial ?? ESTRANGEIRO_VAZIO);
  const [mostrarEstrangeiro, setMostrarEstrangeiro] = useState(
    Boolean(estrangeiroInicial) || documentosIniciais.some((d) => DOCUMENTOS_ESTRANGEIRO.some((e) => e.chave === d.tipo)),
  );
  const [erroEstrangeiro, setErroEstrangeiro] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const enviadosPorItem = (chave: string) => docs.filter((d) => d.tipo === chave);
  const pendentes = DOCUMENTOS_PESSOAIS.filter((i) => enviadosPorItem(i.chave).length === 0);

  async function anexar(item: DocumentoConvite, arquivos: FileList) {
    setErros((e) => ({ ...e, [item.chave]: "" }));
    setEnviandoChave(item.chave);
    const falhas: string[] = [];
    try {
      for (const arquivo of Array.from(arquivos)) {
        const form = new FormData();
        form.append("tipo", item.chave);
        form.append("arquivo", arquivo);
        try {
          const res = await fetch(`/api/convites/token/${token}/documentos`, { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) falhas.push(`${arquivo.name}: ${data.erro ?? "não foi possível anexar"}`);
          else setDocs((atual) => [...atual, data.documento]);
        } catch {
          falhas.push(`${arquivo.name}: falha de comunicação com o servidor`);
        }
      }
    } finally {
      setEnviandoChave(null);
      if (falhas.length > 0) setErros((e) => ({ ...e, [item.chave]: falhas.join(" · ") }));
    }
  }

  async function remover(doc: DocumentoEnviado) {
    const res = await fetch(`/api/convites/token/${token}/documentos/${doc.id}`, { method: "DELETE" });
    if (res.ok) setDocs((atual) => atual.filter((d) => d.id !== doc.id));
    else setErros((e) => ({ ...e, [doc.tipo]: "Não foi possível remover o arquivo." }));
  }

  async function salvarEstrangeiro(novo: DadosEstrangeiro) {
    setEstrangeiro(novo);
    setErroEstrangeiro(null);
    try {
      const res = await fetch(`/api/convites/token/${token}/estrangeiro`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(novo),
      });
      if (!res.ok) setErroEstrangeiro("Não foi possível salvar essa informação.");
    } catch {
      setErroEstrangeiro("Falha de comunicação com o servidor.");
    }
  }

  async function finalizar() {
    setErroGeral(null);
    const aviso =
      pendentes.length > 0
        ? `Ainda faltam ${pendentes.length} documento(s) em vermelho. Depois de finalizar, este link deixa de funcionar e você precisará entregar o restante ao RH. Finalizar mesmo assim?`
        : "Depois de finalizar, este link deixa de funcionar. Finalizar o cadastro?";
    if (!window.confirm(aviso)) return;
    setFinalizando(true);
    try {
      const res = await fetch(`/api/convites/token/${token}/finalizar`, { method: "POST" });
      if (!res.ok) {
        setErroGeral("Não foi possível finalizar. Tente novamente.");
        return;
      }
      onFinalizado();
    } catch {
      setErroGeral("Falha de comunicação com o servidor.");
    } finally {
      setFinalizando(false);
    }
  }

  function linhaDocumento(item: DocumentoConvite, destacarFalta: boolean) {
    const enviados = enviadosPorItem(item.chave);
    const falta = destacarFalta && enviados.length === 0;
    const formato = item.formato ?? "pdf";
    const cheio = enviados.length >= REGRAS_ANEXO.maxArquivosPorItem;
    return (
      <div className={`rounded-md border px-3 py-2 ${falta ? "border-status-danger/40 bg-status-danger/5" : "border-hairline"}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-medium ${falta ? "text-status-danger" : "text-foreground"}`}>{item.nome}</p>
            {item.dica && <p className="mt-0.5 text-[11px] text-foreground-muted">{item.dica}</p>}
          </div>
          {enviados.length > 0 && <span className="shrink-0 text-[11px] font-semibold text-status-success">✓ Anexado</span>}
          {falta && <span className="shrink-0 text-[11px] font-semibold text-status-danger">Pendente</span>}
          <label
            title={cheio ? "Limite de arquivos atingido" : "Anexar arquivo"}
            className={`shrink-0 rounded border border-hairline px-2 py-1 text-[15px] leading-none ${
              cheio || enviandoChave === item.chave
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-surface-page"
            }`}
          >
            {enviandoChave === item.chave ? <span className="text-[11px]">Enviando…</span> : <>📎<span className="sr-only"> Anexar {item.nome}</span></>}
            <input
              type="file"
              accept={ACCEPT_HTML[formato]}
              multiple
              className="hidden"
              disabled={cheio || enviandoChave === item.chave}
              onChange={(e) => {
                const arquivos = e.target.files;
                if (arquivos && arquivos.length > 0) void anexar(item, arquivos);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {enviados.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {enviados.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[11.5px] text-foreground-muted">
                <span className="min-w-0 flex-1 truncate">{d.arquivo.replace(`${item.nome} — `, "")}</span>
                <button
                  type="button"
                  onClick={() => void remover(d)}
                  className="shrink-0 text-status-danger hover:underline"
                  aria-label={`Remover ${d.arquivo}`}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
        {erros[item.chave] && <p className="mt-1 text-[11px] text-status-danger">{erros[item.chave]}</p>}
      </div>
    );
  }

  function simNao(rotulo: string, valor: boolean | null, onChange: (v: boolean) => void) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] text-foreground">{rotulo}</span>
        {([true, false] as const).map((opcao) => (
          <button
            key={String(opcao)}
            type="button"
            onClick={() => onChange(opcao)}
            className={`rounded border px-3 py-1 text-[12px] font-medium ${
              valor === opcao ? "border-brand-primary bg-brand-primary-050 text-brand-primary-800" : "border-hairline text-foreground-muted"
            }`}
          >
            {opcao ? "Sim" : "Não"}
          </button>
        ))}
      </div>
    );
  }

  const prazo = new Date(expiraEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2">
        <p className="text-[12.5px] font-semibold text-status-success">✓ Seus dados pessoais foram enviados ao RH</p>
        <p className="text-[11.5px] text-foreground-muted">Agora anexe seus documentos pessoais abaixo.</p>
      </div>

      <div className="rounded-md border border-hairline bg-surface-page px-3 py-2 text-[11.5px] text-foreground-muted">
        <p className="font-semibold text-foreground">Regras para anexar</p>
        <ul className="mt-1 list-disc pl-4">
          <li>Anexe em <strong>PDF</strong> (a foto 3x4 pode ser JPG ou PNG), com até <strong>10 MB</strong> por arquivo.</li>
          <li>Documentos de frente e verso, como Identidade e CTPS, vão juntos em um único PDF.</li>
          <li>O arquivo precisa estar legível, completo e dentro da validade.</li>
          <li>Até {REGRAS_ANEXO.maxArquivosPorItem} arquivos por documento; use 📎 para anexar e &quot;Remover&quot; para trocar.</li>
          <li>
            Nenhum documento é obrigatório: o que não for anexado aparece em <span className="font-semibold text-status-danger">vermelho</span> como pendente.
          </li>
          <li>Este link vale até {prazo}.</li>
        </ul>
      </div>

      <p className="mt-1 text-[10.5px] font-semibold tracking-wide text-brand-primary-800 uppercase">Documentos pessoais</p>
      <div className="flex flex-col gap-2">
        {DOCUMENTOS_PESSOAIS.map((item) => (
          <div key={item.chave}>{linhaDocumento(item, true)}</div>
        ))}
      </div>

      <div className="mt-2 border-t border-hairline pt-3">
        <button
          type="button"
          onClick={() => setMostrarEstrangeiro((v) => !v)}
          className="text-[10.5px] font-semibold tracking-wide text-brand-primary-800 uppercase"
        >
          {mostrarEstrangeiro ? "▾" : "▸"} Estrangeiro <span className="font-normal normal-case text-foreground-muted">— preencha só se for o seu caso</span>
        </button>
        {mostrarEstrangeiro && (
          <div className="mt-2 flex flex-col gap-2">
            {DOCUMENTOS_ESTRANGEIRO.map((item) => (
              <div key={item.chave}>{linhaDocumento(item, true)}</div>
            ))}
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-medium text-foreground-muted">Data da naturalização</span>
              <input
                type="date"
                value={estrangeiro.dataNaturalizacao ?? ""}
                onChange={(e) => void salvarEstrangeiro({ ...estrangeiro, dataNaturalizacao: e.target.value || null })}
                className={INPUT_CLASS}
              />
            </label>
            <div>{simNao("Casado(a) com brasileiro(a)", estrangeiro.casadoComBrasileiro, (v) => void salvarEstrangeiro({ ...estrangeiro, casadoComBrasileiro: v }))}</div>
            <div>{simNao("Filho(a) com brasileiro(a)", estrangeiro.filhoComBrasileiro, (v) => void salvarEstrangeiro({ ...estrangeiro, filhoComBrasileiro: v }))}</div>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13px] text-foreground">Visto</span>
              {VISTOS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => void salvarEstrangeiro({ ...estrangeiro, visto: estrangeiro.visto === v ? null : v })}
                  className={`rounded border px-2.5 py-1 text-[12px] font-medium ${
                    estrangeiro.visto === v ? "border-brand-primary bg-brand-primary-050 text-brand-primary-800" : "border-hairline text-foreground-muted"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {erroEstrangeiro && <p className="text-[11px] text-status-danger">{erroEstrangeiro}</p>}
          </div>
        )}
      </div>

      {erroGeral && <p className="rounded-md bg-status-danger/10 px-3 py-2 text-[12px] text-status-danger">{erroGeral}</p>}

      <p className="text-[11.5px] text-foreground-muted">
        {DOCUMENTOS_PESSOAIS.length - pendentes.length} de {DOCUMENTOS_PESSOAIS.length} documentos anexados
        {pendentes.length > 0 && <span className="font-semibold text-status-danger"> · {pendentes.length} pendente(s)</span>}
      </p>
      <button
        type="button"
        disabled={finalizando || enviandoChave !== null}
        onClick={() => void finalizar()}
        className="rounded-md bg-brand-primary px-4 py-2 text-[13px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800 disabled:opacity-60"
      >
        {finalizando ? "Finalizando…" : "Finalizar cadastro"}
      </button>
    </div>
  );
}
