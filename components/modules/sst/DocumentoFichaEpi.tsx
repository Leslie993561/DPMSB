import type { DocumentoFicha } from "@/lib/sst/fichas";

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataIsoParaBr(iso: string | null): string {
  if (!iso || iso.length < 10) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** Texto do termo de recebimento de EPI adotado pelo RH da MSB. */
const TERMO_ABERTURA = [
  "Reconheço ter sido orientado sobre os riscos à saúde dos eventuais agentes agressivos do meu trabalho e ter sido orientado adequadamente sobre as proteções que devem ser tomadas.",
  "Reconheço, também, estar recebendo todos os equipamentos de proteção individual necessários à minha função e ter sido treinado e orientado quanto a sua correta e obrigatória utilização.",
];

const TERMO_DECLARACOES = [
  "Ter recebido treinamento sobre a utilização adequada destes EPIs, seu prazo de validade, bem como dos riscos que estou sujeito pelo seu não uso;",
  "Indenizar a empresa, autorizando o desconto do custo da reparação do dano que eventualmente vier a provocar nos EPIs em questão, por atos de negligência ou mau uso, extravio ou na sua não devolução quando a mim solicitado, já que atesto tê-lo recebido em perfeitas condições (ciente e colocando minha anuência às disposições do Art. 462 da CLT);",
  "Estar ciente da disposição legal constante na Norma Regulamentadora NR 01, sub-item 1.8.1 e item 1.9, de que constitui ato faltoso a recusa injustificada de usar os EPIs fornecidos pelo empregador, incorrendo nas penalidades previstas na legislação pertinente;",
  "Que na não observância do seu uso, por negligência, os danos e/ou lesões resultantes de acidentes serão de minha inteira responsabilidade.",
];

/** A ficha de entrega de EPI e, depois de assinada, o comprovante da assinatura eletrônica. */
export function DocumentoFichaEpi({ documento }: { documento: DocumentoFicha }) {
  const a = documento.assinatura;
  return (
    <div className="flex flex-col gap-3 text-[12px] text-foreground">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.1em] text-brand-primary-800 uppercase">
          Ficha de entrega de EPI nº {documento.numero}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-msb.png" alt="MSB" width={80} height={25} className="shrink-0" />
      </div>

      <div className="rounded-md border border-hairline px-3 py-2">
        <p>
          <span className="font-semibold">NOME DO COLABORADOR:</span> {documento.colaborador.nome}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-6">
          <span>
            <span className="font-semibold">SETOR:</span> {documento.colaborador.departamento ?? "—"}
          </span>
          <span>
            <span className="font-semibold">CARGO:</span> {documento.colaborador.cargo ?? "—"}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5 text-[11.5px] leading-relaxed">
        {TERMO_ABERTURA.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <p className="font-semibold">Declaro ainda:</p>
        <ul className="flex flex-col gap-1 pl-1">
          {TERMO_DECLARACOES.map((t) => (
            <li key={t} className="flex gap-1.5">
              <span className="text-brand-primary">►</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-hidden rounded-md border border-hairline">
        <p className="bg-surface-page px-2.5 py-1 text-center text-[10px] font-bold tracking-[0.12em] text-foreground uppercase">
          Recebimento
        </p>
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-t border-hairline bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
              <th className="px-2.5 py-1.5">Data</th>
              <th className="px-2.5 py-1.5">C.A.</th>
              <th className="px-2.5 py-1.5 text-right">Quant.</th>
              <th className="px-2.5 py-1.5">Equipamento fornecido</th>
              <th className="px-2.5 py-1.5">Val.</th>
            </tr>
          </thead>
          <tbody>
            {documento.itens.map((i, idx) => (
              <tr key={idx} className="border-t border-hairline/70">
                <td className="px-2.5 py-1.5">{i.dataEntrega || "—"}</td>
                <td className="px-2.5 py-1.5">{i.ca || "—"}</td>
                <td className="px-2.5 py-1.5 text-right">{i.qtd}</td>
                <td className="px-2.5 py-1.5 font-medium">{i.epi}</td>
                <td className="px-2.5 py-1.5">{i.dataTroca || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {a ? (
        <div className="rounded-md border border-status-success-border bg-status-success-bg p-3">
          <p className="text-[12px] font-semibold text-status-success">
            ✓ Assinatura do colaborador — assinado eletronicamente em {dataHora(a.assinadaEm)}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
            {[
              ["Nome", a.nome],
              ["CPF", a.cpf || "—"],
              ["RG", a.rg],
              ["E-mail", a.email],
              ["Cargo", a.cargo ?? "—"],
              ["Departamento", a.departamento ?? "—"],
              ["Data de admissão", dataIsoParaBr(a.dataAdmissao)],
              ["Data da assinatura", dataHora(a.assinadaEm)],
              ["IP", a.ip],
            ].map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">{rotulo}</dt>
                <dd className="break-words">{valor}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <dt className="text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">Link</dt>
              <dd className="break-all text-[11px]">{a.link}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="mt-2 flex flex-col items-center gap-1">
          <span className="w-64 border-t border-foreground-muted/60" />
          <span className="text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
            Assinatura do colaborador
          </span>
        </div>
      )}
    </div>
  );
}
