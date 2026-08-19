"use client";

import { useEffect, useState } from "react";
import type { Colaborador, SexoColaborador, TipoTransporte, Vinculo } from "@/lib/db/colaboradores";
import type { SexoDependente } from "@/lib/db/colaboradorDependentes";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { cn } from "@/lib/cn";

const INPUT_CLASS =
  "w-full rounded border border-hairline bg-background px-2 py-1 text-[12px] font-light text-foreground placeholder:text-foreground-muted/60 disabled:cursor-not-allowed disabled:border-hairline/70 disabled:bg-surface-page disabled:text-foreground-muted dark:border-brand-neutral/30";

const VINCULOS: Vinculo[] = ["CLT", "CLT-bio", "PJ", "EST", "JÁ"];

interface DependenteForm {
  nome: string;
  cpf: string;
  sexo: SexoDependente | "";
  dataNascimento: string;
  certidaoLivro: string;
  certidaoFolha: string;
  certidaoMatricula: string;
  certidaoDataEmissao: string;
}

const DEPENDENTE_VAZIO: DependenteForm = {
  nome: "",
  cpf: "",
  sexo: "",
  dataNascimento: "",
  certidaoLivro: "",
  certidaoFolha: "",
  certidaoMatricula: "",
  certidaoDataEmissao: "",
};

/** "JOÃO DA SILVA" / "joão da silva" → "João Da Silva" — nome sempre em Maiúsculo e Minúsculo. */
function paraTitleCase(nome: string): string {
  return nome.toLowerCase().replace(/\p{L}+/gu, (palavra) => palavra[0].toUpperCase() + palavra.slice(1));
}

function IconeLapis() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M14.85 2.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12l-1.1 1.1-3-3 1.1-1.1Zm-2.16 2.16 3 3L6.94 16.06a1 1 0 0 1-.46.26l-3.1.83.83-3.1a1 1 0 0 1 .26-.46L12.7 4.3Z" />
    </svg>
  );
}

/** Divisor com rótulo em versalete, usado para separar o formulário em blocos temáticos. */
function Secao({ titulo }: { titulo: string }) {
  return (
    <p className="mt-1 border-t border-hairline pt-2 text-[10px] font-semibold tracking-wide text-brand-primary-800 uppercase dark:border-brand-neutral/30">
      {titulo}
    </p>
  );
}

interface Props {
  colaboradores: Colaborador[];
  /** Presente = edição de um colaborador existente; ausente = cadastro novo. */
  colaboradorEditando?: Colaborador;
  onSalvo: () => void;
  onCancelar: () => void;
}

export function ColaboradorForm({ colaboradores, colaboradorEditando, onSalvo, onCancelar }: Props) {
  const editando = colaboradorEditando;

  // Dados pessoais
  const [nome, setNome] = useState(editando?.nome ?? "");
  const [cpf, setCpf] = useState(editando?.cpf ?? "");
  const [pis, setPis] = useState(editando?.pis ?? "");
  const [dataNascimento, setDataNascimento] = useState(editando?.dataNascimento ?? "");
  const [cidadeNascimento, setCidadeNascimento] = useState(editando?.cidadeNascimento ?? "");
  const [ufNascimento, setUfNascimento] = useState(editando?.ufNascimento ?? "");
  const [nomePai, setNomePai] = useState(editando?.nomePai ?? "");
  const [nomeMae, setNomeMae] = useState(editando?.nomeMae ?? "");
  const [telefone, setTelefone] = useState(editando?.telefone ?? "");
  const [sexo, setSexo] = useState<SexoColaborador | "">(editando?.sexo ?? "");
  const [emailPessoal, setEmailPessoal] = useState(editando?.emailPessoal ?? "");

  // Dados profissionais
  const [email, setEmail] = useState(editando?.email ?? "");
  const [cargo, setCargo] = useState(editando?.cargo ?? "");
  const [departamento, setDepartamento] = useState(editando?.departamento ?? "");
  const [vinculo, setVinculo] = useState<Vinculo | "">(editando?.vinculo ?? "CLT");
  const [cbo, setCbo] = useState(editando?.cbo ?? "");
  const [gestorId, setGestorId] = useState(editando?.gestorId ? String(editando.gestorId) : "");
  const [salarioBase, setSalarioBase] = useState(editando ? String(editando.salarioBase) : "");
  const [horario, setHorario] = useState(editando?.horario ?? "");
  const [dataAdmissao, setDataAdmissao] = useState(editando?.dataAdmissao ?? "");

  // Dados bancários
  const [banco, setBanco] = useState(editando?.banco ?? "");
  const [agencia, setAgencia] = useState(editando?.agencia ?? "");
  const [conta, setConta] = useState(editando?.conta ?? "");

  // Benefícios (VT/VM + VA)
  const [alimentacaoValor, setAlimentacaoValor] = useState(
    editando?.alimentacaoValor ? String(editando.alimentacaoValor) : "",
  );
  const [tipoTransporte, setTipoTransporte] = useState<TipoTransporte>(editando?.tipoTransporte ?? "vt_diario");
  const [valorTransporteFixo, setValorTransporteFixo] = useState(
    editando?.valorTransporteFixo ? String(editando.valorTransporteFixo) : "",
  );

  // Endereço
  const [cep, setCep] = useState(editando?.cep ?? "");
  const [estado, setEstado] = useState(editando?.estado ?? "");
  const [cidade, setCidade] = useState(editando?.cidade ?? "");
  const [bairro, setBairro] = useState(editando?.bairro ?? "");
  const [rua, setRua] = useState(editando?.rua ?? "");
  const [numero, setNumero] = useState(editando?.numero ?? "");

  // Cônjuge
  const [conjugeNome, setConjugeNome] = useState(editando?.conjugeNome ?? "");
  const [conjugeCpf, setConjugeCpf] = useState(editando?.conjugeCpf ?? "");
  const [conjugeNascimento, setConjugeNascimento] = useState(editando?.conjugeNascimento ?? "");

  const desligado = editando?.status === "desligado";
  const [desligando, setDesligando] = useState(false);
  const [dataDesligamento, setDataDesligamento] = useState(editando?.dataDesligamento ?? "");
  const [valorRescisao, setValorRescisao] = useState(editando?.valorRescisao ? String(editando.valorRescisao) : "");
  const [motivoDesligamento, setMotivoDesligamento] = useState(editando?.motivoDesligamento ?? "");

  const [temDependente, setTemDependente] = useState(false);
  const [dependentesForm, setDependentesForm] = useState<DependenteForm[]>([]);

  /** Colaborador existente abre travado — só fica editável depois de clicar no lápis. Cadastro novo já nasce editável. */
  const [modoEdicao, setModoEdicao] = useState(false);
  const bloqueado = Boolean(editando) && !modoEdicao;

  useEffect(() => {
    if (!editando) return;
    let cancelado = false;
    fetch(`/api/colaboradores/${editando.id}/dependentes`)
      .then((res) => res.json())
      .then((data: { dependentes?: Array<Record<string, unknown>> }) => {
        if (cancelado) return;
        const itens = (data.dependentes ?? []).map(
          (d): DependenteForm => ({
            nome: String(d.nome ?? ""),
            cpf: String(d.cpf ?? ""),
            sexo: (d.sexo as SexoDependente | null) ?? "",
            dataNascimento: String(d.dataNascimento ?? ""),
            certidaoLivro: String(d.certidaoLivro ?? ""),
            certidaoFolha: String(d.certidaoFolha ?? ""),
            certidaoMatricula: String(d.certidaoMatricula ?? ""),
            certidaoDataEmissao: String(d.certidaoDataEmissao ?? ""),
          }),
        );
        if (itens.length > 0) {
          setDependentesForm(itens);
          setTemDependente(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [editando]);

  function atualizarDependente<K extends keyof DependenteForm>(indice: number, campo: K, valor: DependenteForm[K]) {
    setDependentesForm((atual) => atual.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d)));
  }

  function adicionarDependente() {
    setDependentesForm((atual) => [...atual, DEPENDENTE_VAZIO]);
  }

  function removerDependente(indice: number) {
    setDependentesForm((atual) => atual.filter((_, i) => i !== indice));
  }

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const dependentesLista = temDependente
        ? dependentesForm
            .filter((d) => d.nome.trim())
            .map((d) => ({
              nome: paraTitleCase(d.nome),
              cpf: d.cpf || null,
              sexo: d.sexo || null,
              dataNascimento: d.dataNascimento || null,
              certidaoLivro: d.certidaoLivro || null,
              certidaoFolha: d.certidaoFolha || null,
              certidaoMatricula: d.certidaoMatricula || null,
              certidaoDataEmissao: d.certidaoDataEmissao || null,
            }))
        : [];
      const payload = {
        nome: paraTitleCase(nome),
        cpf: cpf || null,
        pis: pis || null,
        dataNascimento: dataNascimento || null,
        cidadeNascimento: cidadeNascimento || null,
        ufNascimento: ufNascimento || null,
        nomePai: nomePai ? paraTitleCase(nomePai) : null,
        nomeMae: nomeMae ? paraTitleCase(nomeMae) : null,
        telefone: telefone || null,
        sexo: sexo || null,
        emailPessoal: emailPessoal || null,
        email: email || null,
        cargo: cargo || null,
        departamento: departamento || null,
        vinculo: vinculo || null,
        cbo: cbo || null,
        gestorId: gestorId ? Number(gestorId) : null,
        salarioBase: Number(salarioBase),
        horario: horario || null,
        dataAdmissao,
        banco: banco || null,
        agencia: agencia || null,
        conta: conta || null,
        alimentacaoValor: alimentacaoValor ? Number(alimentacaoValor) : null,
        tipoTransporte,
        valorTransporteFixo: valorTransporteFixo ? Number(valorTransporteFixo) : null,
        cep: cep || null,
        estado: estado || null,
        cidade: cidade || null,
        bairro: bairro || null,
        rua: rua || null,
        numero: numero || null,
        conjugeNome: conjugeNome ? paraTitleCase(conjugeNome) : null,
        conjugeCpf: conjugeCpf || null,
        conjugeNascimento: conjugeNascimento || null,
        dependentesLista,
        ...(desligado
          ? {
              status: "desligado" as const,
              dataDesligamento: dataDesligamento || null,
              motivoDesligamento: motivoDesligamento || null,
              valorRescisao: valorRescisao ? Number(valorRescisao) : null,
            }
          : {}),
      };
      const res = await fetch(editando ? `/api/colaboradores/${editando.id}` : "/api/colaboradores", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao salvar colaborador.");
        return;
      }
      onSalvo();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleConfirmarDesligamento(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/colaboradores/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "desligado",
          dataDesligamento,
          motivoDesligamento: motivoDesligamento || null,
          valorRescisao: valorRescisao ? Number(valorRescisao) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao desligar colaborador.");
        return;
      }
      onSalvo();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleReativar() {
    if (!editando) return;
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/colaboradores/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ativo" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao reativar colaborador.");
        return;
      }
      onSalvo();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  const outrosColaboradores = colaboradores.filter((c) => c.id !== editando?.id);

  if (desligando && editando) {
    return (
      <form onSubmit={handleConfirmarDesligamento} className="flex flex-col gap-2">
        <p className="rounded border border-status-danger-border bg-status-danger-bg px-2 py-1.5 text-[11px] text-status-danger">
          Desligar <strong>{editando.nome}</strong>. O colaborador passa a aparecer só no filtro &quot;Desl&quot; e
          sai da contagem do quadro ativo.
        </p>

        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Data de desligamento
          <input
            type="date"
            value={dataDesligamento}
            onChange={(e) => setDataDesligamento(e.target.value)}
            required
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Valor da rescisão
          <input
            type="number"
            min={0}
            step="0.01"
            value={valorRescisao}
            onChange={(e) => setValorRescisao(e.target.value)}
            placeholder="R$ 0,00"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Motivo
          <textarea
            value={motivoDesligamento}
            onChange={(e) => setMotivoDesligamento(e.target.value)}
            placeholder="Descreva o motivo do desligamento"
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </label>

        {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

        <div className="mt-0.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDesligando(false)}
            className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground-muted transition-colors hover:bg-surface-page dark:border-brand-neutral/30"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={salvando || !dataDesligamento}
            className="flex flex-1 items-center justify-center gap-1.5 rounded bg-status-danger px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? "Desligando..." : "Confirmar desligamento"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {editando && (
        <div className="flex items-center justify-between rounded border border-hairline bg-surface-page px-2 py-1 dark:border-brand-neutral/30">
          <p className="text-[10.5px] font-normal text-foreground-muted">
            {modoEdicao ? "Edição habilitada" : "Dados bloqueados — clique no lápis para editar"}
          </p>
          <button
            type="button"
            onClick={() => setModoEdicao((v) => !v)}
            title={modoEdicao ? "Bloquear edição" : "Habilitar edição"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              modoEdicao
                ? "bg-brand-primary-100 text-brand-primary-800"
                : "text-foreground-muted hover:bg-background hover:text-brand-primary",
            )}
          >
            <IconeLapis />
          </button>
        </div>
      )}

      {desligado && (
        <div className="flex flex-col gap-2 rounded border border-status-danger-border bg-status-danger-bg p-2">
          <p className="text-[10.5px] font-semibold text-status-danger">Colaborador desligado</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-0 text-[10px] font-normal text-status-danger">
              Data de desligamento
              <input
                type="date"
                value={dataDesligamento}
                onChange={(e) => setDataDesligamento(e.target.value)}
                disabled={bloqueado}
                className={INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-0 text-[10px] font-normal text-status-danger">
              Valor da rescisão
              <input
                type="number"
                min={0}
                step="0.01"
                value={valorRescisao}
                onChange={(e) => setValorRescisao(e.target.value)}
                placeholder="R$ 0,00"
                disabled={bloqueado}
                className={INPUT_CLASS}
              />
            </label>
          </div>
          <label className="flex flex-col gap-0 text-[10px] font-normal text-status-danger">
            Motivo
            <textarea
              value={motivoDesligamento}
              onChange={(e) => setMotivoDesligamento(e.target.value)}
              placeholder="Descreva o motivo do desligamento"
              rows={2}
              disabled={bloqueado}
              className={`${INPUT_CLASS} resize-none`}
            />
          </label>
        </div>
      )}

      <Secao titulo="Dados pessoais" />

      <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
        Nome completo
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={(e) => setNome(paraTitleCase(e.target.value))}
          placeholder="Nome do colaborador"
          required
          disabled={bloqueado}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          CPF
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          PIS
          <input
            value={pis}
            onChange={(e) => setPis(e.target.value)}
            placeholder="000.00000.00-0"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Nascimento
          <input
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Cidade de nascimento
          <input
            value={cidadeNascimento}
            onChange={(e) => setCidadeNascimento(e.target.value)}
            placeholder="ex.: Salvador"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          UF de nascimento
          <input
            value={ufNascimento}
            onChange={(e) => setUfNascimento(e.target.value.toUpperCase())}
            placeholder="BA"
            maxLength={2}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Sexo
          <select
            value={sexo}
            onChange={(e) => setSexo(e.target.value as SexoColaborador)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          >
            <option value="">—</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Nome do pai
          <input
            value={nomePai}
            onChange={(e) => setNomePai(e.target.value)}
            onBlur={(e) => setNomePai(paraTitleCase(e.target.value))}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Nome da mãe
          <input
            value={nomeMae}
            onChange={(e) => setNomeMae(e.target.value)}
            onBlur={(e) => setNomeMae(paraTitleCase(e.target.value))}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Telefone
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          E-mail pessoal
          <input
            type="email"
            value={emailPessoal}
            onChange={(e) => setEmailPessoal(e.target.value)}
            placeholder="pessoal@exemplo.com"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <Secao titulo="Dados profissionais" />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          E-mail profissional
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@msbbrasil.com"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Cargo
          <input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="ex.: Analista"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Departamento
          <input
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            placeholder="ex.: Produção"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Vínculo
          <select
            value={vinculo}
            onChange={(e) => setVinculo(e.target.value as Vinculo)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          >
            {VINCULOS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          CBO
          <input
            value={cbo}
            onChange={(e) => setCbo(e.target.value)}
            placeholder="000000"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Líder direto
          <select
            value={gestorId}
            onChange={(e) => setGestorId(e.target.value)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          >
            <option value="">Nome do gestor</option>
            {outrosColaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Salário
          <input
            type="number"
            min={0}
            step="0.01"
            value={salarioBase}
            onChange={(e) => setSalarioBase(e.target.value)}
            placeholder="R$ 0,00"
            required
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Horário
          <input
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="ex.: 07h50-11h50 12h50-17h50"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
        Data de admissão
        <input
          type="date"
          value={dataAdmissao}
          onChange={(e) => setDataAdmissao(e.target.value)}
          required
          disabled={bloqueado}
          className={INPUT_CLASS}
        />
      </label>

      <Secao titulo="Dados bancários" />

      <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
        Banco
        <input
          value={banco}
          onChange={(e) => setBanco(e.target.value)}
          placeholder="ex.: Itaú"
          disabled={bloqueado}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Agência
          <input
            value={agencia}
            onChange={(e) => setAgencia(e.target.value)}
            placeholder="0000-0"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Conta
          <input
            value={conta}
            onChange={(e) => setConta(e.target.value)}
            placeholder="00000-0"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <Secao titulo="Benefícios" />

      <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
        Alimentação
        <input
          type="number"
          min={0}
          step="0.01"
          value={alimentacaoValor}
          onChange={(e) => setAlimentacaoValor(e.target.value)}
          placeholder="R$ 0,00"
          disabled={bloqueado}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Transporte
          <div className="flex gap-1">
            <label className="flex flex-1 items-center gap-1 rounded border border-hairline px-1.5 py-1 text-[10.5px] font-light text-foreground dark:border-brand-neutral/30">
              <input
                type="radio"
                name="tipoTransporte"
                checked={tipoTransporte === "vt_diario"}
                onChange={() => setTipoTransporte("vt_diario")}
                disabled={bloqueado}
                className="accent-brand-primary"
              />
              VT/dia
            </label>
            <label className="flex flex-1 items-center gap-1 rounded border border-hairline px-1.5 py-1 text-[10.5px] font-light text-foreground dark:border-brand-neutral/30">
              <input
                type="radio"
                name="tipoTransporte"
                checked={tipoTransporte === "vm_fixo"}
                onChange={() => setTipoTransporte("vm_fixo")}
                disabled={bloqueado}
                className="accent-brand-primary"
              />
              VM/fixo
            </label>
          </div>
        </label>

        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          {tipoTransporte === "vt_diario" ? "Valor do VT (por dia útil)" : "Valor do VM (fixo mensal)"}
          <input
            type="number"
            min={0}
            step="0.01"
            value={valorTransporteFixo}
            onChange={(e) => setValorTransporteFixo(e.target.value)}
            placeholder="R$ 0,00"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <Secao titulo="Endereço" />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          CEP
          <input
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            placeholder="00000-000"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Estado
          <input
            value={estado}
            onChange={(e) => setEstado(e.target.value.toUpperCase())}
            placeholder="BA"
            maxLength={2}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Cidade
          <input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="ex.: Salvador"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Bairro
          <input
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Rua
          <input value={rua} onChange={(e) => setRua(e.target.value)} disabled={bloqueado} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Número
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <Secao titulo="Cônjuge" />

      <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
        Nome do cônjuge
        <input
          value={conjugeNome}
          onChange={(e) => setConjugeNome(e.target.value)}
          onBlur={(e) => setConjugeNome(paraTitleCase(e.target.value))}
          disabled={bloqueado}
          className={INPUT_CLASS}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          CPF
          <input
            value={conjugeCpf}
            onChange={(e) => setConjugeCpf(e.target.value)}
            placeholder="000.000.000-00"
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
          Nascimento
          <input
            type="date"
            value={conjugeNascimento}
            onChange={(e) => setConjugeNascimento(e.target.value)}
            disabled={bloqueado}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <Secao titulo="Dependentes" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-normal text-foreground-muted">Colaborador tem dependente(s)?</span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => {
              setTemDependente(true);
              if (dependentesForm.length === 0) setDependentesForm([DEPENDENTE_VAZIO]);
            }}
            className={cn(
              "flex-1 rounded border px-1.5 py-1 text-[10.5px] font-light disabled:cursor-not-allowed",
              temDependente ? "border-brand-primary bg-brand-primary-100 text-brand-primary-800" : "border-hairline text-foreground-muted",
            )}
          >
            Sim
          </button>
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => {
              setTemDependente(false);
              setDependentesForm([]);
            }}
            className={cn(
              "flex-1 rounded border px-1.5 py-1 text-[10.5px] font-light disabled:cursor-not-allowed",
              !temDependente ? "border-brand-primary bg-brand-primary-100 text-brand-primary-800" : "border-hairline text-foreground-muted",
            )}
          >
            Não
          </button>
        </div>
      </div>

      {temDependente &&
        dependentesForm.map((dep, i) => (
          <div key={i} className="flex flex-col gap-2 rounded border border-hairline p-2 dark:border-brand-neutral/30">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-foreground-muted">Dependente {i + 1}</span>
              {dependentesForm.length > 1 && (
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => removerDependente(i)}
                  className="text-[10px] font-medium text-status-danger disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remover
                </button>
              )}
            </div>

            <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
              Nome
              <input
                value={dep.nome}
                onChange={(e) => atualizarDependente(i, "nome", e.target.value)}
                onBlur={(e) => atualizarDependente(i, "nome", paraTitleCase(e.target.value))}
                placeholder="Nome do dependente"
                disabled={bloqueado}
                className={INPUT_CLASS}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
                Nascimento
                <input
                  type="date"
                  value={dep.dataNascimento}
                  onChange={(e) => atualizarDependente(i, "dataNascimento", e.target.value)}
                  disabled={bloqueado}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
                CPF
                <input
                  value={dep.cpf}
                  onChange={(e) => atualizarDependente(i, "cpf", e.target.value)}
                  placeholder="000.000.000-00"
                  disabled={bloqueado}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
                Sexo
                <select
                  value={dep.sexo}
                  onChange={(e) => atualizarDependente(i, "sexo", e.target.value as SexoDependente)}
                  disabled={bloqueado}
                  className={INPUT_CLASS}
                >
                  <option value="">—</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </label>
              <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
                Data de emissão da certidão
                <input
                  type="date"
                  value={dep.certidaoDataEmissao}
                  onChange={(e) => atualizarDependente(i, "certidaoDataEmissao", e.target.value)}
                  disabled={bloqueado}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
                Livro da certidão
                <input
                  value={dep.certidaoLivro}
                  onChange={(e) => atualizarDependente(i, "certidaoLivro", e.target.value)}
                  disabled={bloqueado}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
                Folha da certidão
                <input
                  value={dep.certidaoFolha}
                  onChange={(e) => atualizarDependente(i, "certidaoFolha", e.target.value)}
                  disabled={bloqueado}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <label className="flex flex-col gap-0 text-[10px] font-normal text-foreground-muted">
              Matrícula da certidão
              <input
                value={dep.certidaoMatricula}
                onChange={(e) => atualizarDependente(i, "certidaoMatricula", e.target.value)}
                disabled={bloqueado}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        ))}

      {temDependente && (
        <button
          type="button"
          disabled={bloqueado}
          onClick={adicionarDependente}
          className="self-start text-[11px] font-medium text-brand-primary underline decoration-dotted underline-offset-2 hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Adicionar outro dependente
        </button>
      )}

      {erro && <RiskCallout nivel="critico">{erro}</RiskCallout>}

      <div className="mt-0.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded border border-hairline px-3 py-1.5 text-[12px] font-medium text-foreground-muted transition-colors hover:bg-surface-page dark:border-brand-neutral/30"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={salvando || bloqueado}
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {salvando ? (
            "Salvando..."
          ) : (
            <>
              <span aria-hidden>✓</span> {editando ? "Salvar alterações" : "Salvar colaborador"}
            </>
          )}
        </button>
      </div>

      {editando && !desligado && (
        <button
          type="button"
          onClick={() => setDesligando(true)}
          className="mt-0.5 self-start text-[11px] font-medium text-status-danger underline decoration-dotted underline-offset-2 hover:no-underline"
        >
          Desligar colaborador
        </button>
      )}

      {editando && desligado && (
        <button
          type="button"
          onClick={handleReativar}
          disabled={salvando}
          className="mt-0.5 self-start text-[11px] font-medium text-status-success underline decoration-dotted underline-offset-2 hover:no-underline disabled:opacity-50"
        >
          Reativar colaborador (readmitir)
        </button>
      )}
    </form>
  );
}
