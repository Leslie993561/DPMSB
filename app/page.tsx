import Link from "next/link";

const MODULOS = [
  { href: "/dashboard", titulo: "Dashboard", descricao: "Indicadores gerais de férias: programadas, vencidas, custos previstos." },
  { href: "/ferias", titulo: "Férias", descricao: "Controle de férias, simulador, alertas inteligentes e lançamentos." },
  { href: "/colaboradores", titulo: "Colaboradores", descricao: "Cadastro usado pela Gestão de Férias." },
  { href: "/chat", titulo: "Chat com o Assistente", descricao: "Tire dúvidas, envie documentos e receba análises com base legal." },
  { href: "/rescisao", titulo: "Rescisão", descricao: "Calcule as verbas rescisórias conforme o tipo de desligamento." },
  { href: "/folha", titulo: "Folha de Pagamento", descricao: "Faça upload de uma planilha e calcule a folha em lote." },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-foreground-muted">
        Cálculos trabalhistas rodam em um motor determinístico auditável; a IA atua apenas na
        interpretação, explicação e sinalização de riscos — nunca faz contas por conta própria.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULOS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-brand-surface bg-background p-5 transition-colors hover:border-brand-primary dark:border-brand-neutral/30"
          >
            <h2 className="font-medium text-foreground">{m.titulo}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{m.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
