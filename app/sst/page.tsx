import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { obterDashboardSst } from "@/lib/sst/dashboard";
import { formatarMoeda } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";
import { SectionTitle } from "@/components/modules/sst/BlocosSst";

export const metadata = { title: "Dashboard SST — Portal Recursos Humanos" };

function TabelaMensal({ titulo, meses }: { titulo: string; meses: { mesLabel: string; valor: number }[] }) {
  return (
    <section className="space-y-2">
      <SectionTitle>{titulo}</SectionTitle>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-background text-left font-bold tracking-wide text-foreground-muted uppercase">
              <th className="px-3 py-2 text-[10.5px]">Mês</th>
              <th className="px-3 py-2 text-right text-[10.5px]">Valor gasto</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mesLabel} className="border-t border-hairline/60">
                <td className="px-3 py-1.5 font-semibold text-foreground">{m.mesLabel}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-foreground">{formatarMoeda(m.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

export default async function SstDashboardPage() {
  // Defesa extra além do bloqueio já feito em proxy.ts.
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    redirect("/sem-acesso");
  }

  const data = await obterDashboardSst();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SST" titulo="Dashboard" subtitulo="Valor gasto em cada mês do ano" />
      <div className="grid gap-4 lg:grid-cols-2">
        <TabelaMensal titulo="EPI" meses={data.custoMensalEpiExames.map((m) => ({ mesLabel: m.mesLabel, valor: m.epi }))} />
        <TabelaMensal
          titulo="Exames Ocupacionais"
          meses={data.custoMensalEpiExames.map((m) => ({ mesLabel: m.mesLabel, valor: m.exames }))}
        />
      </div>
    </div>
  );
}
