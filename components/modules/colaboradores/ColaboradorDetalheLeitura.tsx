"use client";

import type { Colaborador } from "@/lib/db/colaboradores";
import { formatarDataBr } from "@/lib/format";

function Campo({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0">
      <span className="text-[10px] font-normal text-foreground-muted">{label}</span>
      <span className="text-[12.5px] text-foreground">{valor || "—"}</span>
    </div>
  );
}

/**
 * Só dados PROFISSIONAIS do liderado — gestor não edita nem vê CPF, endereço,
 * banco, cônjuge, documentos ou salário de quem lidera (LGPD); quem
 * cadastra e edita é sempre o RH. A API já devolve o colaborador com os
 * campos pessoais nulos pra esta sessão (ver `paraColaboradorProfissional`),
 * então esta tela não precisa filtrar nada por conta própria.
 */
export function ColaboradorDetalheLeitura({ colaborador }: { colaborador: Colaborador }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-md bg-brand-primary-050 px-3 py-2 text-[11px] text-brand-primary-800">
        Como gestor, você vê só os dados profissionais da sua equipe. Pra editar cadastro ou consultar dados
        pessoais, fale com o RH.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nome completo" valor={colaborador.nome} />
        <Campo label="Cargo" valor={colaborador.cargo} />
        <Campo label="Departamento" valor={colaborador.departamento} />
        <Campo label="Vínculo" valor={colaborador.vinculo} />
        <Campo label="CBO" valor={colaborador.cbo} />
        <Campo label="Horário" valor={colaborador.horario} />
        <Campo label="Admissão" valor={formatarDataBr(colaborador.dataAdmissao)} />
        <Campo label="E-mail profissional" valor={colaborador.email} />
        <Campo label="Status" valor={colaborador.status === "desligado" ? "Desligado" : "Ativo"} />
      </div>
    </div>
  );
}
