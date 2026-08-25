"use client";

import { useState } from "react";
import type { CampoColaborador, SugestaoColuna } from "@/lib/parsing/mappers";
import type { LinhaPlanilha } from "@/lib/parsing/spreadsheet";
import { RiskCallout } from "@/components/shared/RiskCallout";

const ROTULOS: Record<CampoColaborador, string> = {
  nome: "Nome",
  cpf: "CPF",
  pis: "PIS",
  dataNascimento: "Nascimento",
  cidadeNascimento: "Cidade de nascimento",
  ufNascimento: "UF de nascimento",
  nomePai: "Nome do pai",
  nomeMae: "Nome da mãe",
  telefone: "Telefone",
  sexo: "Sexo",
  emailPessoal: "E-mail pessoal",
  email: "E-mail profissional",
  cargo: "Cargo",
  departamento: "Departamento",
  vinculo: "Vínculo",
  cbo: "CBO",
  liderDireto: "Líder direto",
  salarioBase: "Salário base",
  horario: "Horário",
  dataAdmissao: "Data de admissão",
  banco: "Banco",
  agencia: "Agência",
  conta: "Conta",
  alimentacaoValor: "Alimentação",
  cep: "CEP",
  estado: "Estado",
  cidade: "Cidade",
  bairro: "Bairro",
  rua: "Rua",
  numero: "Número",
  conjugeNome: "Cônjuge — Nome",
  conjugeCpf: "Cônjuge — CPF",
  conjugeNascimento: "Cônjuge — Nascimento",
  dependentes: "Dependentes (quantidade)",
};

export function ImportarColaboradoresPanel({ onImportado }: { onImportado: () => void }) {
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);
  const [mapeamento, setMapeamento] = useState<Partial<Record<CampoColaborador, string | null>>>({});

  const [resultado, setResultado] = useState<{
    criados: number;
    atualizados: number;
    descartadas: { linha: number; motivo: string }[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setResultado(null);
    setCarregando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const res = await fetch("/api/colaboradores/importar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler a planilha.");
        return;
      }
      setCabecalhos(data.cabecalhos);
      setLinhas(data.linhas);
      const inicial: Partial<Record<CampoColaborador, string | null>> = {};
      (data.sugestoes as SugestaoColuna<CampoColaborador>[]).forEach((s) => {
        inicial[s.campo] = s.coluna;
      });
      setMapeamento(inicial);
    } catch {
      setErro("Falha ao enviar o arquivo.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarImportacao() {
    if (!mapeamento.salarioBase || !mapeamento.dataAdmissao) {
      setErro("Mapeie ao menos as colunas de salário base e data de admissão.");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/colaboradores/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas, mapeamento }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao importar.");
        return;
      }
      setResultado(data);
      setCabecalhos([]);
      setLinhas([]);
      onImportado();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  const campos = Object.keys(ROTULOS) as CampoColaborador[];

  return (
    <div>
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">Exportar</p>
          <a
            href="/api/colaboradores/exportar"
            download
            className="flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-medium text-brand-white hover:bg-brand-primary-hover"
          >
            ↓ Exportar planilha (todos os colaboradores)
          </a>
        </div>

        <div className="border-t border-hairline pt-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase">Importar</p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border border-hairline bg-brand-primary-050 px-3 py-2.5">
          <p className="text-[11.5px] text-foreground-muted">
            Baixe o modelo, preencha uma linha por colaborador e anexe o arquivo preenchido logo abaixo.
          </p>
          <a
            href="/api/colaboradores/modelo"
            download
            className="flex shrink-0 items-center gap-1 rounded border border-brand-primary/40 bg-background px-2.5 py-1.5 text-[11.5px] font-medium text-brand-primary-800 hover:bg-brand-primary-100"
          >
            ↓ Baixar modelo
          </a>
        </div>

        <label className="flex flex-col gap-1 text-sm text-foreground-muted">
          Escolher arquivo (.xlsx, .xls ou .csv — máx. 5 MB)
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleUpload}
            className="w-full rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-brand-white dark:border-brand-neutral/30"
          />
        </label>

        {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

        {cabecalhos.length > 0 && (
          <>
            <p className="text-sm text-foreground-muted">
              As colunas abaixo foram detectadas automaticamente por semelhança de nome. Confirme ou
              corrija antes de importar — um mapeamento errado grava dados errados no cadastro.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {campos.map((campo) => (
                <label key={campo} className="flex flex-col gap-1 text-sm text-foreground-muted">
                  {ROTULOS[campo]}
                  <select
                    value={mapeamento[campo] ?? ""}
                    onChange={(e) => setMapeamento({ ...mapeamento, [campo]: e.target.value || null })}
                    className="rounded-md border border-brand-surface bg-background px-3 py-2 text-sm text-foreground dark:border-brand-neutral/30"
                  >
                    <option value="">— não mapeado —</option>
                    {cabecalhos.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={confirmarImportacao}
              disabled={carregando}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {carregando ? "Importando..." : `Importar ${linhas.length} linha(s)`}
            </button>
          </>
        )}

        {resultado && (
          <div className="space-y-2">
            <RiskCallout nivel="info">
              {/* Criados e atualizados aparecem separados: reimportar a mesma
                  planilha agora atualiza em vez de duplicar, e quem lê precisa
                  ver que nada foi criado de novo. */}
              {resultado.criados > 0 && <>{resultado.criados} colaborador(es) criado(s). </>}
              {resultado.atualizados > 0 && <>{resultado.atualizados} já existia(m) e foi(ram) atualizado(s). </>}
              {resultado.criados === 0 && resultado.atualizados === 0 && <>Nenhuma linha aplicada.</>}
            </RiskCallout>
            {resultado.descartadas.length > 0 && (
              <RiskCallout nivel="atencao">
                {resultado.descartadas.length} linha(s) descartadas:
                <ul className="mt-1 list-inside list-disc">
                  {resultado.descartadas.map((d, i) => (
                    <li key={i}>
                      Linha {d.linha}: {d.motivo}
                    </li>
                  ))}
                </ul>
              </RiskCallout>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
