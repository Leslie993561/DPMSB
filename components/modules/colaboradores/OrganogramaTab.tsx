"use client";

import type { Colaborador } from "@/lib/db/colaboradores";

/**
 * Estrutura de liderança da MSB, informada manualmente pelo DP (organograma
 * oficial) — não é derivada de "líder direto", porque boa parte das pessoas
 * citadas como líder na planilha não têm cadastro próprio no quadro de
 * colaboradores importado.
 *
 * `cargo`/`departamento` casam com os valores reais do cadastro; a contagem
 * exibida em cada caixa é sempre calculada AO VIVO a partir dos colaboradores
 * (nunca um número fixo), consistente com o princípio do app de nunca exibir
 * dado calculado que não venha de uma fonte real.
 */
interface DefinicaoCargo {
  rotulo: string;
  cargo: string;
  departamento: string;
  lideranca?: boolean;
  filhos?: DefinicaoCargo[];
}

const ORGANOGRAMA: DefinicaoCargo = {
  rotulo: "CEO",
  cargo: "CEO",
  departamento: "Diretoria",
  lideranca: true,
  filhos: [
    {
      rotulo: "Diretor",
      cargo: "Diretor",
      departamento: "Diretoria",
      lideranca: true,
      filhos: [
        { rotulo: "KAM", cargo: "KAM", departamento: "Comercial" },
        { rotulo: "Analista", cargo: "Analista", departamento: "Financeiro" },
        { rotulo: "Analista", cargo: "Analista", departamento: "Contábil" },
        {
          rotulo: "Analista",
          cargo: "Analista",
          departamento: "Administrativo",
          filhos: [{ rotulo: "Jovem Aprendiz", cargo: "Jovem Ap.", departamento: "Administrativo" }],
        },
        {
          rotulo: "Supervisora",
          cargo: "Supervisora",
          departamento: "Operações de Vendas",
          lideranca: true,
          filhos: [{ rotulo: "Assistente", cargo: "Assistente", departamento: "Operações de Vendas" }],
        },
        { rotulo: "Analista", cargo: "Analista", departamento: "Recursos Humanos" },
        { rotulo: "Assistente", cargo: "Assistente", departamento: "Recursos Humanos" },
        { rotulo: "Assistente", cargo: "Assistente", departamento: "Tecnologia da Informacao" },
        {
          rotulo: "Coordenadora",
          cargo: "Coordenadora",
          departamento: "Engenharia",
          lideranca: true,
          filhos: [
            { rotulo: "Analista", cargo: "Analista", departamento: "Engenharia" },
            { rotulo: "Estagiário", cargo: "Estagiário", departamento: "Engenharia" },
          ],
        },
        {
          rotulo: "Coordenadora",
          cargo: "Coordenadora",
          departamento: "Garantia da Qualidade",
          lideranca: true,
          filhos: [
            { rotulo: "Analista", cargo: "Analista", departamento: "Garantia da Qualidade" },
            { rotulo: "Auxiliar", cargo: "Auxiliar", departamento: "Garantia da Qualidade" },
          ],
        },
        {
          rotulo: "Gerente",
          cargo: "Gerente",
          departamento: "Industrial",
          lideranca: true,
          filhos: [
            {
              rotulo: "Supervisora",
              cargo: "Supervisora",
              departamento: "Produção",
              lideranca: true,
              filhos: [
                {
                  rotulo: "Líder",
                  cargo: "Lider",
                  departamento: "Produção",
                  lideranca: true,
                  filhos: [{ rotulo: "Auxiliar", cargo: "Auxiliar", departamento: "Produção" }],
                },
              ],
            },
            {
              rotulo: "Líder",
              cargo: "Lider",
              departamento: "Manutenção",
              lideranca: true,
              filhos: [{ rotulo: "Técnico", cargo: "Técnico", departamento: "Manutenção" }],
            },
            {
              rotulo: "Analista",
              cargo: "Analista",
              departamento: "Planejamento",
              filhos: [{ rotulo: "Assistente", cargo: "Assistente", departamento: "Planejamento" }],
            },
            {
              rotulo: "Supervisora",
              cargo: "Supervisora",
              departamento: "Controle da Qualidade",
              lideranca: true,
              filhos: [
                { rotulo: "Assistente", cargo: "Assistente", departamento: "Controle da Qualidade" },
                { rotulo: "Inspetora", cargo: "Inspetora", departamento: "Controle da Qualidade" },
                { rotulo: "Jovem Aprendiz", cargo: "Jovem Ap.", departamento: "Controle da Qualidade" },
              ],
            },
            { rotulo: "Assistente", cargo: "Assistente", departamento: "Logística" },
          ],
        },
      ],
    },
  ],
};

const COR_LIDERANCA_CEO = "#60859C";
const COR_LIDERANCA = "#579EB4";
const COR_BORDA_EQUIPE = "#579EB4";
const COR_BADGE_BG = "#9FD4DE";
const COR_BADGE_TEXTO = "#1F3A44";
const COR_CONECTOR = "#818286";

function contarColaboradores(colaboradores: Colaborador[], def: DefinicaoCargo): number {
  return colaboradores.filter(
    (c) => (c.cargo ?? "").trim() === def.cargo && (c.departamento ?? "").trim() === def.departamento,
  ).length;
}

function CaixaCargo({ def, qtd, raiz = false }: { def: DefinicaoCargo; qtd: number; raiz?: boolean }) {
  const lideranca = raiz || def.lideranca;
  const cor = raiz ? COR_LIDERANCA_CEO : COR_LIDERANCA;

  return (
    <div className="relative inline-block">
      <div
        className={
          lideranca
            ? "min-w-[132px] rounded-xl px-4 py-2.5 text-center shadow-card"
            : "min-w-[120px] rounded-xl border-[1.5px] bg-[#FEFEFE] px-3 py-1.5 text-center shadow-card"
        }
        style={
          lideranca
            ? { background: cor, color: "#FFFFFF" }
            : { borderColor: COR_BORDA_EQUIPE, color: "#333333" }
        }
      >
        <p className={lideranca ? "text-[12.5px] font-semibold" : "text-[11.5px] font-medium"}>{def.rotulo}</p>
        <p className={lideranca ? "text-[10px] text-white/80 italic" : "text-[10px] text-[#333333]/70 italic"}>
          {def.departamento}
        </p>
      </div>
      {qtd > 1 && (
        <span
          className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold shadow-card"
          style={{ background: COR_BADGE_BG, color: COR_BADGE_TEXTO }}
        >
          {qtd}
        </span>
      )}
    </div>
  );
}

function NoOrganograma({ def, colaboradores }: { def: DefinicaoCargo; colaboradores: Colaborador[] }) {
  const qtd = contarColaboradores(colaboradores, def);
  const filhosVisiveis = (def.filhos ?? []).filter(
    (f) => contarColaboradores(colaboradores, f) > 0 || (f.filhos?.length ?? 0) > 0,
  );

  if (qtd === 0 && filhosVisiveis.length === 0) return null;

  return (
    <li>
      <CaixaCargo def={def} qtd={qtd} />
      {filhosVisiveis.length > 0 && (
        <ul>
          {filhosVisiveis.map((filho, i) => (
            <NoOrganograma key={`${filho.rotulo}-${i}`} def={filho} colaboradores={colaboradores} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrganogramaTab({ colaboradores }: { colaboradores: Colaborador[] }) {
  if (colaboradores.length === 0) {
    return (
      <p className="rounded-xl border border-brand-surface bg-background p-5 text-sm text-foreground-muted dark:border-brand-neutral/30">
        Nenhum colaborador cadastrado ainda.
      </p>
    );
  }

  const qtdRaiz = contarColaboradores(colaboradores, ORGANOGRAMA);

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground-muted">
        Estrutura de liderança da MSB, por cargo — sem nomes, só posições e o número de pessoas em cada uma
        (contado ao vivo no cadastro atual).
      </p>

      <h2
        className="inline-block text-[13px] font-semibold tracking-wide uppercase underline decoration-2 underline-offset-4"
        style={{ color: COR_LIDERANCA_CEO }}
      >
        Organograma — MSB
      </h2>

      <div
        className="overflow-x-auto rounded-lg border border-hairline p-8"
        style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #D9E2E4 100%)" }}
      >
        <div className="organograma-tree" style={{ ["--cor-conector" as string]: COR_CONECTOR }}>
          <ul>
            <li>
              <CaixaCargo def={ORGANOGRAMA} qtd={qtdRaiz} raiz />
              {ORGANOGRAMA.filhos && ORGANOGRAMA.filhos.length > 0 && (
                <ul>
                  {ORGANOGRAMA.filhos.map((filho, i) => (
                    <NoOrganograma key={`${filho.rotulo}-${i}`} def={filho} colaboradores={colaboradores} />
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
