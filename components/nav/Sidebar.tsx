"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavCounts } from "@/lib/db/navCounts";
import { useOperador } from "@/lib/currentUser";
import { iniciais } from "@/lib/format";
import { Logo } from "./Logo";

function IconeFerias() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm10 6H4v8h12V8Z" />
    </svg>
  );
}

function IconeColaboradores() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 16c0-2.76 2.24-5 5-5s5 2.24 5 5v1H2v-1Zm11.5-3c2.02 0 4.5 1.6 4.5 4v1h-4v-1c0-1.5-.53-2.86-1.4-3.94.29-.04.59-.06.9-.06Z" />
    </svg>
  );
}

function IconeBreakdown() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 2a8 8 0 1 0 8 8h-8V2Z" />
      <path d="M12 2.2A8.01 8.01 0 0 1 17.8 8H12V2.2Z" />
    </svg>
  );
}

function IconeBeneficios() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 2c1.1 0 2 .9 2 2 0 .35-.09.68-.25.97.44.32.75.83.75 1.42V7H4V6.4c0-.6.31-1.1.75-1.43A1.99 1.99 0 0 1 8 3.99c0-1.1.9-2 2-2ZM4 8h12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" />
    </svg>
  );
}


interface SubItem {
  href: string;
  label: string;
}

interface GrupoItem {
  id: string;
  label: string;
  Icone: () => React.ReactElement;
  badge?: number;
  base: string;
  itens: SubItem[];
}

function montarGrupos(counts?: NavCounts): GrupoItem[] {
  return [
    {
      id: "colaboradores",
      label: "Colaboradores",
      Icone: IconeColaboradores,
      badge: counts?.colaboradores,
      base: "/colaboradores",
      itens: [
        { href: "/colaboradores?aba=quadro", label: "Quadro de colaboradores" },
      ],
    },
    {
      id: "ferias",
      label: "Férias",
      Icone: IconeFerias,
      badge: counts?.feriasEmAberto,
      base: "/dashboard",
      itens: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/ferias?aba=controle", label: "Controle de Férias" },
        { href: "/ferias?aba=planejamento", label: "Planejamento de Férias" },
      ],
    },
    {
      id: "folha",
      label: "Breakdown",
      Icone: IconeBreakdown,
      badge: counts?.folha,
      base: "/folha",
      itens: [
        { href: "/folha?aba=dashboard", label: "Dashboard" },
        { href: "/folha?aba=relatorio", label: "Relatório detalhado" },
      ],
    },
    {
      id: "beneficios",
      label: "Benefícios",
      Icone: IconeBeneficios,
      base: "/beneficios",
      itens: [
        { href: "/beneficios?aba=dashboard", label: "Dashboard" },
        { href: "/beneficios?aba=rateio", label: "Rateio" },
      ],
    },
  ];
}

export function Sidebar({ counts }: { counts?: NavCounts }) {
  const pathname = usePathname();
  const grupos = montarGrupos(counts);
  const [aberto, setAberto] = useState<string | null>(
    grupos.find((g) => pathname === g.base || pathname?.startsWith(`${g.base}/`))?.id ?? null,
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-hairline bg-background">
      <Logo />
      <nav className="flex flex-1 flex-col gap-1 px-3 pb-2">
        {grupos.map((grupo) => {
          const grupoAtivo = pathname === grupo.base || pathname?.startsWith(`${grupo.base}/`);
          const expandido = aberto === grupo.id;
          return (
            <div key={grupo.id}>
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : grupo.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                  grupoAtivo
                    ? "bg-brand-primary-100 text-brand-primary-800"
                    : "text-foreground-muted hover:bg-surface-page hover:text-foreground",
                )}
              >
                <span className={cn(grupoAtivo ? "text-brand-primary" : "text-brand-neutral")}>
                  <grupo.Icone />
                </span>
                <span className="flex-1 text-left">{grupo.label}</span>
                {typeof grupo.badge === "number" && (
                  <span className="min-w-[18px] rounded-full bg-brand-primary-100 px-1.5 py-0.5 text-center text-[11px] font-bold text-brand-primary-800">
                    {grupo.badge}
                  </span>
                )}
                <span className="text-[10px] text-brand-primary">{expandido ? "▲" : "▼"}</span>
              </button>

              {expandido && (
                <div className="mt-0.5 mb-1 ml-[21px] flex flex-col gap-0.5 border-l border-hairline pl-3">
                  {grupo.itens.map((item) => {
                    const itemPath = item.href.split("?")[0];
                    const itemAtivo = pathname === itemPath;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] font-normal transition-colors",
                          itemAtivo
                            ? "text-brand-primary-800"
                            : "text-foreground-muted hover:bg-surface-page hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-[5px] w-[5px] shrink-0 rounded-full",
                            itemAtivo ? "bg-brand-primary" : "bg-brand-surface",
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      </nav>

      <UserCard />
    </aside>
  );
}

function UserCard() {
  const { operador, setOperador } = useOperador();
  const [editando, setEditando] = useState(false);
  const nomeExibido = operador || "Leslie Silva Souza";

  return (
    <div className="border-t border-hairline p-3">
      {editando ? (
        <input
          autoFocus
          defaultValue={operador}
          placeholder="Seu nome (operador)"
          onBlur={(e) => {
            setOperador(e.target.value);
            setEditando(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full rounded-md border border-brand-primary bg-background px-2 py-1.5 text-xs text-foreground"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          title="Clique para editar o nome do operador"
          className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-page"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-brand-white">
            {iniciais(nomeExibido)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground">{nomeExibido}</span>
            <span className="block truncate text-[11px] text-foreground-muted">Assistente de RH</span>
          </span>
        </button>
      )}
    </div>
  );
}
