"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Colaborador } from "@/lib/db/colaboradores";
import { FilterChip } from "@/components/shared/FilterChip";
import { Drawer } from "@/components/shared/Drawer";
import { BotaoPrimario } from "@/components/shared/PageHeader";
import { ColaboradorForm } from "./ColaboradorForm";
import { ColaboradoresTable } from "./ColaboradoresTable";
import { ImportarColaboradoresPanel } from "./ImportarColaboradoresPanel";
import { OrganogramaTab } from "./OrganogramaTab";
import { siglaSetor } from "@/lib/setores";

/** Valor sentinela de `filtroPrincipal` para o filtro "Desl" — não é um nome de departamento real. */
const DESLIGADOS = "__DESLIGADOS__";

export function ColaboradoresPageClient() {
  const searchParams = useSearchParams();
  const aba = searchParams.get("aba") === "organograma" ? "organograma" : "quadro";
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroPrincipal, setFiltroPrincipal] = useState("");
  const [drawer, setDrawer] = useState<"fechado" | "novo" | Colaborador>("fechado");
  const [importarAberto, setImportarAberto] = useState(false);

  const verDesligados = filtroPrincipal === DESLIGADOS;

  async function recarregar() {
    try {
      const res = await fetch("/api/colaboradores");
      const data = await res.json();
      setColaboradores(data.colaboradores ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
  }, []);

  const ativos = useMemo(() => colaboradores.filter((c) => c.status !== "desligado"), [colaboradores]);
  const desligados = useMemo(() => colaboradores.filter((c) => c.status === "desligado"), [colaboradores]);

  const setores = useMemo(
    () => Array.from(new Set(ativos.map((c) => c.departamento).filter((d): d is string => Boolean(d)))).sort(),
    [ativos],
  );

  const filtrados = useMemo(() => {
    const buscaNorm = busca.trim().toLowerCase();
    const base = verDesligados ? desligados : ativos;
    return base.filter((c) => {
      const bateBusca = !buscaNorm || c.nome.toLowerCase().includes(buscaNorm);
      const bateSetor = verDesligados || !filtroPrincipal || c.departamento === filtroPrincipal;
      return bateBusca && bateSetor;
    });
  }, [ativos, desligados, busca, filtroPrincipal, verDesligados]);

  const vinculos = Array.from(new Set(ativos.map((c) => c.vinculo).filter(Boolean)));

  return (
    <div className="space-y-3">
      {carregando ? (
        <p className="text-sm text-foreground-muted">Carregando...</p>
      ) : aba === "organograma" ? (
        <>
          <CabecalhoQuadro
            titulo="Organograma"
            subtitulo={`${ativos.length} colaborador(es)${vinculos.length ? ` · ${vinculos.join(", ")}` : ""}`}
            onAdicionar={() => setDrawer("novo")}
            importarAberto={importarAberto}
            onImportar={() => setImportarAberto((v) => !v)}
            onFecharImportar={() => setImportarAberto(false)}
          >
            <ImportarColaboradoresPanel
              onImportado={() => {
                setImportarAberto(false);
                void recarregar();
              }}
            />
          </CabecalhoQuadro>
          <OrganogramaTab colaboradores={ativos} />
        </>
      ) : (
        <>
          <CabecalhoQuadro
            titulo="Quadro de colaboradores"
            subtitulo={`${ativos.length} colaborador(es)${vinculos.length ? ` · ${vinculos.join(", ")}` : ""}`}
            onAdicionar={() => setDrawer("novo")}
            importarAberto={importarAberto}
            onImportar={() => setImportarAberto((v) => !v)}
            onFecharImportar={() => setImportarAberto(false)}
          >
            <ImportarColaboradoresPanel
              onImportado={() => {
                setImportarAberto(false);
                void recarregar();
              }}
            />
          </CabecalhoQuadro>

          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome"
              className="w-40 rounded border border-hairline bg-background px-2 py-1 text-[11px] text-foreground dark:border-brand-neutral/30"
            />
            {setores.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <FilterChip ativo={!verDesligados && !filtroPrincipal} onClick={() => setFiltroPrincipal("")}>
                  Todos
                </FilterChip>
                {setores.map((s) => (
                  <FilterChip
                    key={s}
                    ativo={!verDesligados && filtroPrincipal === s}
                    onClick={() => setFiltroPrincipal(s)}
                    title={s}
                  >
                    {siglaSetor(s)}
                  </FilterChip>
                ))}
                <button
                  type="button"
                  onClick={() => setFiltroPrincipal(verDesligados ? "" : DESLIGADOS)}
                  title="Mostrar apenas colaboradores desligados"
                  className={
                    verDesligados
                      ? "rounded-full border border-status-danger bg-status-danger-bg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-status-danger"
                      : "rounded-full border border-hairline bg-background px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-status-danger transition-colors hover:bg-status-danger-bg"
                  }
                >
                  Desl
                </button>
              </div>
            )}
          </div>

          <div className="rounded-md border border-hairline bg-background shadow-card">
            <ColaboradoresTable colaboradores={filtrados} onEditar={setDrawer} />
          </div>
        </>
      )}

      <Drawer
        aberto={drawer !== "fechado"}
        onFechar={() => setDrawer("fechado")}
        icone={
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 7c0-2.76 2.24-5 5-5s5 2.24 5 5v1H2v-1Zm13-4h1.5v-2H15v-1.5h-1.5V10H12v1.5h-1.5v2H12V15h1.5v-2H15Z" />
          </svg>
        }
        titulo={drawer !== "fechado" && drawer !== "novo" ? "Editar colaborador" : "Adicionar colaborador"}
        subtitulo={
          drawer !== "fechado" && drawer !== "novo" ? `${drawer.nome} · ${drawer.cargo ?? "—"}` : undefined
        }
      >
        {drawer !== "fechado" && (
          <ColaboradorForm
            colaboradores={colaboradores}
            colaboradorEditando={drawer === "novo" ? undefined : drawer}
            onCancelar={() => setDrawer("fechado")}
            onSalvo={() => {
              setDrawer("fechado");
              void recarregar();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

function CabecalhoQuadro({
  titulo,
  subtitulo,
  onAdicionar,
  importarAberto,
  onImportar,
  onFecharImportar,
  children,
}: {
  titulo: string;
  subtitulo: string;
  onAdicionar: () => void;
  importarAberto: boolean;
  onImportar: () => void;
  onFecharImportar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-background px-4 py-3 shadow-card">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.1em] text-brand-primary-800 uppercase">Colaboradores</p>
        <h1 className="text-[15px] font-semibold text-foreground">{titulo}</h1>
        <p className="text-[11.5px] font-light text-foreground-muted">{subtitulo}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={onImportar}
            className="rounded border border-hairline px-3 py-2 text-[12.5px] font-medium text-foreground-muted transition-colors hover:bg-surface-page dark:border-brand-neutral/30"
          >
            Importar/Exportar
          </button>
          {importarAberto && (
            <>
              <div className="fixed inset-0 z-20" onClick={onFecharImportar} />
              <div className="absolute top-full right-0 z-30 mt-1.5 w-[420px] rounded-md border border-hairline bg-background p-3 shadow-drawer">
                {children}
              </div>
            </>
          )}
        </div>
        <BotaoPrimario onClick={onAdicionar} className="px-3 py-2 text-[12.5px]">
          <span aria-hidden>+</span> Adicionar colaborador
        </BotaoPrimario>
      </div>
    </div>
  );
}
