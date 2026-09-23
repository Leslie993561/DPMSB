"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavCounts } from "@/lib/db/navCounts";
import type { SessaoPayload } from "@/lib/auth/token";
import { permiteAcesso } from "@/lib/acesso/rotas";
import { iniciais } from "@/lib/format";
import { Logo } from "./Logo";
import { GerenciarAcessoModal } from "@/components/modules/acesso/GerenciarAcessoModal";

function IconeAcesso() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm2 6V6a2 2 0 1 0-4 0v2h4Zm-2 3a1.5 1.5 0 0 1 1 2.62V15a1 1 0 1 1-2 0v-1.38A1.5 1.5 0 0 1 10 11Z"
      />
    </svg>
  );
}

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

function IconePortal() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M4 4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4Zm7 0a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4ZM4 11a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3Zm7 0a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3Z" />
    </svg>
  );
}

function IconeEpi() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2 3 5v5c0 4.42 2.98 8.1 7 9 4.02-.9 7-4.58 7-9V5l-7-3Zm-1.2 11.2L5.6 10l1.4-1.4 1.8 1.8L14 6.2l1.4 1.4-6.6 5.6Z"
      />
    </svg>
  );
}

function IconeExames() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M8 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H9V3a1 1 0 0 0-1-1Zm-1 8h6v2H7v-2Zm0 3.5h4v2H7v-2Z" />
    </svg>
  );
}

function IconeProgramas() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.83a2 2 0 0 0-.59-1.42l-4.82-4.82A2 2 0 0 0 10.17 2H5Zm1 9h8v1.5H6V11Zm0 3.5h8V16H6v-1.5Z"
      />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M6 3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4a1 1 0 1 0 0-2H7V5h3a1 1 0 1 0 0-2H6Zm7.29 3.29a1 1 0 0 0 0 1.42L14.59 9H9a1 1 0 1 0 0 2h5.59l-1.3 1.29a1 1 0 0 0 1.42 1.42l3-3a1 1 0 0 0 0-1.42l-3-3a1 1 0 0 0-1.42 0Z" />
    </svg>
  );
}


interface SubItem {
  href: string;
  label: string;
  /** Chave de `lib/acesso/modulos.ts` — decide se o item some pra um gestor sem permissão. */
  modulo: string;
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
        { href: "/colaboradores?aba=quadro", label: "Quadro de colaboradores", modulo: "colaboradores.quadro" },
      ],
    },
    {
      id: "ferias",
      label: "Férias",
      Icone: IconeFerias,
      badge: counts?.feriasEmAberto,
      base: "/dashboard",
      itens: [
        { href: "/dashboard", label: "Dashboard", modulo: "ferias.dashboard" },
        { href: "/ferias?aba=controle", label: "Controle de Férias", modulo: "ferias.controle" },
        { href: "/ferias?aba=planejamento", label: "Planejamento de Férias", modulo: "ferias.planejamento" },
      ],
    },
    {
      id: "folha",
      label: "Breakdown",
      Icone: IconeBreakdown,
      badge: counts?.folha,
      base: "/folha",
      itens: [
        { href: "/folha?aba=dashboard", label: "Dashboard", modulo: "folha.dashboard" },
        { href: "/folha?aba=relatorio", label: "Relatório detalhado", modulo: "folha.relatorio" },
      ],
    },
    {
      id: "beneficios",
      label: "Benefícios",
      Icone: IconeBeneficios,
      base: "/beneficios",
      itens: [
        { href: "/beneficios?aba=dashboard", label: "Dashboard", modulo: "beneficios.dashboard" },
        { href: "/beneficios?aba=rateio", label: "Rateio", modulo: "beneficios.rateio" },
      ],
    },
  ];
}

/**
 * Frentes do portal. Cada uma é servida por páginas DESTE MESMO app Next.js
 * (mesma sidebar, mesmo layout) — nenhuma delas leva a outro site ou abre
 * outra aba. O SST está em migração: por enquanto só o Dashboard é real, os
 * demais módulos mostram "em construção" até serem portados.
 */
const FRENTES = [
  { id: "dp", label: "Portal DP", href: "/dashboard" },
  { id: "sst", label: "Portal SST", href: "/sst" },
  { id: "dho", label: "Portal DHO", href: "/dho" },
] as const;

const MODULOS_SST = [
  { id: "sst-dashboard", label: "Dashboard", href: "/sst", Icone: IconeBreakdown },
  { id: "sst-epi", label: "Gestão de EPI", href: "/sst/epi", Icone: IconeEpi },
  { id: "sst-exames", label: "Exames Ocupacionais", href: "/sst/exames", Icone: IconeExames },
  { id: "sst-programas", label: "Programas SST", href: "/sst/programas", Icone: IconeProgramas },
] as const;

export function Sidebar({ counts, sessao }: { counts?: NavCounts; sessao: SessaoPayload }) {
  const pathname = usePathname();
  const ehAdmin = sessao.tipo === "administrador";
  const liberados = new Set(sessao.liberados);
  const frenteAtual = pathname?.startsWith("/sst") ? "sst" : pathname?.startsWith("/dho") ? "dho" : "dp";
  const [frenteMenuAberto, setFrenteMenuAberto] = useState(false);

  // Gestor comum só vê o que foi liberado pra ele; item sem permissão some da
  // lista, e o grupo inteiro some junto se nenhum dos filhos sobrar.
  const grupos = montarGrupos(counts)
    .map((grupo) => ({
      ...grupo,
      itens: ehAdmin ? grupo.itens : grupo.itens.filter((item) => permiteAcesso(item.modulo, liberados)),
    }))
    .filter((grupo) => grupo.itens.length > 0);

  const [aberto, setAberto] = useState<string | null>(
    grupos.find((g) => pathname === g.base || pathname?.startsWith(`${g.base}/`))?.id ?? null,
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-hairline bg-background">
      <Logo />

      <div className="relative px-3 pt-1 pb-1">
        <div className="flex w-full items-center gap-2.5 rounded-lg bg-brand-primary-100 px-3 py-2 text-[13px] font-semibold text-brand-primary-800 transition-colors">
          <Link href="/" className="flex flex-1 items-center gap-2.5">
            <span className="text-brand-primary">
              <IconePortal />
            </span>
            <span className="text-left">Portal Recursos Humanos</span>
          </Link>
          <button
            type="button"
            onClick={() => setFrenteMenuAberto((v) => !v)}
            className="px-1 text-[10px] text-brand-primary"
          >
            {frenteMenuAberto ? "▲" : "▼"}
          </button>
        </div>

        {frenteMenuAberto && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setFrenteMenuAberto(false)} />
            <div className="relative z-30 mt-0.5 mb-1 ml-[21px] flex flex-col gap-0.5 border-l border-hairline pl-3">
              {FRENTES.map((f) => (
                <Link
                  key={f.id}
                  href={f.href}
                  onClick={() => setFrenteMenuAberto(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] font-normal transition-colors",
                    f.id === frenteAtual
                      ? "text-brand-primary-800"
                      : "text-foreground-muted hover:bg-surface-page hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-[5px] w-[5px] shrink-0 rounded-full",
                      f.id === frenteAtual ? "bg-brand-primary" : "bg-brand-surface",
                    )}
                  />
                  <span>{f.label}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pb-2">
        {frenteAtual === "dho" && (
          <p className="px-2 py-2 text-[11.5px] text-foreground-muted">Nenhum módulo de DHO cadastrado ainda.</p>
        )}
        {frenteAtual === "sst" &&
          MODULOS_SST.map((m) => {
            const ativo = pathname === m.href || pathname?.startsWith(`${m.href}/`);
            return (
              <Link
                key={m.id}
                href={m.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                  ativo
                    ? "bg-brand-primary-100 text-brand-primary-800"
                    : "text-foreground-muted hover:bg-surface-page hover:text-foreground",
                )}
              >
                <span className={cn(ativo ? "text-brand-primary" : "text-brand-neutral")}>
                  <m.Icone />
                </span>
                <span>{m.label}</span>
              </Link>
            );
          })}
        {frenteAtual === "dp" &&
        grupos.map((grupo) => {
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

      <UserCard sessao={sessao} />
    </aside>
  );
}

function UserCard({ sessao }: { sessao: SessaoPayload }) {
  const router = useRouter();
  const [acessoAberto, setAcessoAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const ehAdmin = sessao.tipo === "administrador";

  async function sair() {
    setSaindo(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="border-t border-hairline p-3">
      <div className="flex items-center gap-1.5">
        <span
          title={sessao.email}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-brand-white">
            {iniciais(sessao.nome)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground">{sessao.nome}</span>
            <span className="block truncate text-[11px] text-foreground-muted">
              {ehAdmin ? "Administrador" : (sessao.cargo ?? "Gestor")}
            </span>
          </span>
        </span>
        {ehAdmin && (
          <button
            type="button"
            onClick={() => setAcessoAberto(true)}
            title="Gerenciar acesso de gestores ao portal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-page hover:text-brand-primary-800"
          >
            <IconeAcesso />
          </button>
        )}
        <button
          type="button"
          onClick={() => void sair()}
          disabled={saindo}
          title="Sair do portal"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-page hover:text-status-danger disabled:opacity-60"
        >
          <IconeSair />
        </button>
      </div>

      {ehAdmin && <GerenciarAcessoModal aberto={acessoAberto} onFechar={() => setAcessoAberto(false)} />}
    </div>
  );
}
