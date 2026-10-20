import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaSst } from "@/lib/auth/perfil";
import { escopoColaboradoresDoGestor } from "@/lib/acesso/equipeGestor";
import { obterDashboardSst } from "@/lib/sst/dashboard";
import { listarEpisParaComprar } from "@/lib/sst/epi";
import { PageHeader } from "@/components/shared/PageHeader";
import { CustoTrimestral } from "@/components/modules/sst/CustoTrimestral";

export const metadata = { title: "Dashboard SST — Portal Recursos Humanos" };

export default async function SstDashboardPage() {
  // Defesa extra além do bloqueio já feito em proxy.ts.
  const sessao = await obterSessaoAtual();
  if (!acessaSst(sessao)) {
    redirect("/sem-acesso");
  }

  // Gestor comum só enxerga os números da própria equipe; admin/RH-editor (null) veem tudo.
  const escopo = await escopoColaboradoresDoGestor();
  const [data, comprar] = await Promise.all([obterDashboardSst(escopo), listarEpisParaComprar(escopo)]);
  const trimestreAtual = Math.floor(new Date().getMonth() / 3);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SST" titulo="Dashboard" subtitulo="Valor gasto em cada trimestre e mês do ano" />
      <CustoTrimestral
        titulo="EPI"
        unidade="itens entregues"
        trimestreAtual={trimestreAtual}
        comprar={comprar}
        meses={data.custoMensalEpiExames.map((m) => ({ mesLabel: m.mesLabel, valor: m.epi, qtd: m.epiQtd }))}
      />
      <CustoTrimestral
        titulo="Exames ocupacionais"
        unidade="exames realizados"
        trimestreAtual={trimestreAtual}
        meses={data.custoMensalEpiExames.map((m) => ({ mesLabel: m.mesLabel, valor: m.exames, qtd: m.examesQtd }))}
      />
    </div>
  );
}
