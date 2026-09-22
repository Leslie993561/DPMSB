"use client";

import { useEffect, useState } from "react";

const INPUT_CLASS =
  "w-full rounded border border-hairline bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-foreground-muted/60";

interface DependenteForm {
  nome: string;
  cpf: string;
  sexo: "M" | "F" | "";
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

interface DadosPessoais {
  cpf: string | null;
  pis: string | null;
  dataNascimento: string | null;
  cidadeNascimento: string | null;
  ufNascimento: string | null;
  nomePai: string | null;
  nomeMae: string | null;
  telefone: string | null;
  sexo: "M" | "F" | null;
  emailPessoal: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  conjugeNome: string | null;
  conjugeCpf: string | null;
  conjugeNascimento: string | null;
  conjugeSexo: "M" | "F" | null;
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <p className="mt-4 border-t border-hairline pt-3 text-[10.5px] font-semibold tracking-wide text-brand-primary-800 uppercase">
      {titulo}
    </p>
  );
}

function Campo({
  label,
  value,
  onChange,
  tipo = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-medium text-foreground-muted">{label}</span>
      <input type={tipo} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
    </label>
  );
}

export function ConviteForm({ token }: { token: string }) {
  const [estado, setEstadoTela] = useState<"carregando" | "invalido" | "formulario" | "enviado">("carregando");
  const [nomeColaborador, setNomeColaborador] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [cpf, setCpf] = useState("");
  const [pis, setPis] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cidadeNascimento, setCidadeNascimento] = useState("");
  const [ufNascimento, setUfNascimento] = useState("");
  const [nomePai, setNomePai] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [telefone, setTelefone] = useState("");
  const [sexo, setSexo] = useState<"M" | "F" | "">("");
  const [emailPessoal, setEmailPessoal] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [cep, setCep] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [conjugeNome, setConjugeNome] = useState("");
  const [conjugeCpf, setConjugeCpf] = useState("");
  const [conjugeNascimento, setConjugeNascimento] = useState("");
  const [conjugeSexo, setConjugeSexo] = useState<"M" | "F" | "">("");
  const [temDependente, setTemDependente] = useState(false);
  const [dependentes, setDependentes] = useState<DependenteForm[]>([]);

  useEffect(() => {
    fetch(`/api/convites/token/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setEstadoTela("invalido");
          return;
        }
        const data: { nome: string; dados: DadosPessoais } = await res.json();
        setNomeColaborador(data.nome);
        const d = data.dados;
        setCpf(d.cpf ?? "");
        setPis(d.pis ?? "");
        setDataNascimento(d.dataNascimento ?? "");
        setCidadeNascimento(d.cidadeNascimento ?? "");
        setUfNascimento(d.ufNascimento ?? "");
        setNomePai(d.nomePai ?? "");
        setNomeMae(d.nomeMae ?? "");
        setTelefone(d.telefone ?? "");
        setSexo(d.sexo ?? "");
        setEmailPessoal(d.emailPessoal ?? "");
        setBanco(d.banco ?? "");
        setAgencia(d.agencia ?? "");
        setConta(d.conta ?? "");
        setCep(d.cep ?? "");
        setUf(d.estado ?? "");
        setCidade(d.cidade ?? "");
        setBairro(d.bairro ?? "");
        setRua(d.rua ?? "");
        setNumero(d.numero ?? "");
        setConjugeNome(d.conjugeNome ?? "");
        setConjugeCpf(d.conjugeCpf ?? "");
        setConjugeNascimento(d.conjugeNascimento ?? "");
        setConjugeSexo(d.conjugeSexo ?? "");
        setEstadoTela("formulario");
      })
      .catch(() => setEstadoTela("invalido"));
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        cpf: cpf || null,
        pis: pis || null,
        dataNascimento: dataNascimento || null,
        cidadeNascimento: cidadeNascimento || null,
        ufNascimento: ufNascimento || null,
        nomePai: nomePai || null,
        nomeMae: nomeMae || null,
        telefone: telefone || null,
        sexo: sexo || null,
        emailPessoal: emailPessoal || null,
        banco: banco || null,
        agencia: agencia || null,
        conta: conta || null,
        cep: cep || null,
        estado: uf || null,
        cidade: cidade || null,
        bairro: bairro || null,
        rua: rua || null,
        numero: numero || null,
        conjugeNome: conjugeNome || null,
        conjugeCpf: conjugeCpf || null,
        conjugeNascimento: conjugeNascimento || null,
        conjugeSexo: conjugeSexo || null,
        dependentesLista: temDependente
          ? dependentes.map((d) => ({
              nome: d.nome,
              cpf: d.cpf || null,
              sexo: d.sexo || null,
              dataNascimento: d.dataNascimento || null,
              certidaoLivro: d.certidaoLivro || null,
              certidaoFolha: d.certidaoFolha || null,
              certidaoMatricula: d.certidaoMatricula || null,
              certidaoDataEmissao: d.certidaoDataEmissao || null,
            }))
          : [],
      };
      const res = await fetch(`/api/convites/token/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.erro ?? "Não foi possível salvar.");
        return;
      }
      setEstadoTela("enviado");
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  if (estado === "carregando") {
    return <p className="py-10 text-center text-[13px] text-foreground-muted">Carregando…</p>;
  }

  if (estado === "invalido") {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-2xl">🔒</span>
        <p className="text-[14px] font-semibold text-foreground">Link inválido ou expirado</p>
        <p className="max-w-sm text-[12.5px] text-foreground-muted">
          Esse link de cadastro não é mais válido — ele expira 2 horas depois de ser gerado, ou já foi usado. Peça
          ao RH para enviar um novo.
        </p>
      </div>
    );
  }

  if (estado === "enviado") {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-2xl">✅</span>
        <p className="text-[14px] font-semibold text-foreground">Dados enviados</p>
        <p className="max-w-sm text-[12.5px] text-foreground-muted">
          Obrigado, {nomeColaborador}. Seus dados foram recebidos pelo RH. Pode fechar esta página.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <p className="text-[12.5px] text-foreground-muted">
        Olá, <strong className="text-foreground">{nomeColaborador}</strong>. Preencha seus dados pessoais abaixo.
      </p>

      <Secao titulo="Dados pessoais" />
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="CPF" value={cpf} onChange={setCpf} />
        <Campo label="PIS" value={pis} onChange={setPis} />
        <Campo label="Data de nascimento" value={dataNascimento} onChange={setDataNascimento} tipo="date" />
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium text-foreground-muted">Sexo</span>
          <select value={sexo} onChange={(e) => setSexo(e.target.value as "M" | "F" | "")} className={INPUT_CLASS}>
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </label>
        <Campo label="Cidade de nascimento" value={cidadeNascimento} onChange={setCidadeNascimento} />
        <Campo label="UF de nascimento" value={ufNascimento} onChange={setUfNascimento} />
        <Campo label="Nome do pai" value={nomePai} onChange={setNomePai} />
        <Campo label="Nome da mãe" value={nomeMae} onChange={setNomeMae} />
        <Campo label="Telefone" value={telefone} onChange={setTelefone} />
        <Campo label="E-mail pessoal" value={emailPessoal} onChange={setEmailPessoal} tipo="email" />
      </div>

      <Secao titulo="Dados bancários" />
      <div className="grid grid-cols-3 gap-2.5">
        <Campo label="Banco" value={banco} onChange={setBanco} />
        <Campo label="Agência" value={agencia} onChange={setAgencia} />
        <Campo label="Conta" value={conta} onChange={setConta} />
      </div>

      <Secao titulo="Endereço" />
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="CEP" value={cep} onChange={setCep} />
        <Campo label="Estado" value={uf} onChange={setUf} />
        <Campo label="Cidade" value={cidade} onChange={setCidade} />
        <Campo label="Bairro" value={bairro} onChange={setBairro} />
        <Campo label="Rua" value={rua} onChange={setRua} />
        <Campo label="Número" value={numero} onChange={setNumero} />
      </div>

      <Secao titulo="Cônjuge" />
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="Nome do cônjuge" value={conjugeNome} onChange={setConjugeNome} />
        <Campo label="CPF do cônjuge" value={conjugeCpf} onChange={setConjugeCpf} />
        <Campo label="Nascimento do cônjuge" value={conjugeNascimento} onChange={setConjugeNascimento} tipo="date" />
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium text-foreground-muted">Sexo do cônjuge</span>
          <select
            value={conjugeSexo}
            onChange={(e) => setConjugeSexo(e.target.value as "M" | "F" | "")}
            className={INPUT_CLASS}
          >
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </label>
      </div>

      <Secao titulo="Dependentes" />
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-foreground-muted">Você tem dependente(s)?</span>
        <button
          type="button"
          onClick={() => setTemDependente(true)}
          className={`rounded border px-3 py-1 text-[12px] font-medium ${
            temDependente ? "border-brand-primary bg-brand-primary-050 text-brand-primary-800" : "border-hairline text-foreground-muted"
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => {
            setTemDependente(false);
            setDependentes([]);
          }}
          className={`rounded border px-3 py-1 text-[12px] font-medium ${
            !temDependente ? "border-brand-primary bg-brand-primary-050 text-brand-primary-800" : "border-hairline text-foreground-muted"
          }`}
        >
          Não
        </button>
      </div>

      {temDependente && (
        <div className="flex flex-col gap-3">
          {dependentes.map((dep, i) => (
            <div key={i} className="rounded-md border border-hairline p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground-muted">Dependente {i + 1}</span>
                <button
                  type="button"
                  onClick={() => setDependentes(dependentes.filter((_, idx) => idx !== i))}
                  className="text-[11px] text-status-danger"
                >
                  Remover
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Campo
                  label="Nome"
                  value={dep.nome}
                  onChange={(v) => setDependentes(dependentes.map((d, idx) => (idx === i ? { ...d, nome: v } : d)))}
                />
                <Campo
                  label="CPF"
                  value={dep.cpf}
                  onChange={(v) => setDependentes(dependentes.map((d, idx) => (idx === i ? { ...d, cpf: v } : d)))}
                />
                <Campo
                  label="Nascimento"
                  tipo="date"
                  value={dep.dataNascimento}
                  onChange={(v) =>
                    setDependentes(dependentes.map((d, idx) => (idx === i ? { ...d, dataNascimento: v } : d)))
                  }
                />
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-medium text-foreground-muted">Sexo</span>
                  <select
                    value={dep.sexo}
                    onChange={(e) =>
                      setDependentes(
                        dependentes.map((d, idx) => (idx === i ? { ...d, sexo: e.target.value as "M" | "F" | "" } : d)),
                      )
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">—</option>
                    <option value="F">Feminino</option>
                    <option value="M">Masculino</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDependentes([...dependentes, DEPENDENTE_VAZIO])}
            className="self-start rounded-md border border-hairline px-3 py-1.5 text-[12px] font-medium text-brand-primary-800"
          >
            + Adicionar dependente
          </button>
        </div>
      )}

      {erro && <p className="rounded-md bg-status-danger/10 px-3 py-2 text-[12px] text-status-danger">{erro}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="mt-2 rounded-md bg-brand-primary px-4 py-2 text-[13px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800 disabled:opacity-60"
      >
        {salvando ? "Enviando…" : "Enviar meus dados"}
      </button>
    </form>
  );
}
