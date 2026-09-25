import { redirect } from "next/navigation";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarProgramasSaude } from "@/lib/sst/programas";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProgramasSaudeClient } from "@/components/modules/sst/ProgramasSaudeClient";

export const metadata = { title: "Programas SST — Portal Recursos Humanos" };

export default async function SstProgramasPage() {
  // proxy.ts já bloqueia /sst/* pra quem não é administrador; checagem extra
  // aqui só por segurança (mesmo padrão da Gestão de EPI e de Exames).
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    redirect("/sem-acesso");
  }

  const programas = await listarProgramasSaude();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="SST" titulo="Programas SST" subtitulo="PCMSO, LTCAT e PGR — vigência e documento anexado" />
      <ProgramasSaudeClient programasIniciais={programas} />
    </div>
  );
}
