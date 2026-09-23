import Link from "next/link";

const FRENTES = [
  { href: "/dashboard", titulo: "Portal DP", descricao: "Departamento Pessoal: férias, folha, colaboradores e rescisão." },
  { href: "/sst", titulo: "Portal SST", descricao: "Segurança e Saúde no Trabalho: EPI, exames, fardamento e acessos." },
  { href: "/dho", titulo: "Portal DHO", descricao: "Desenvolvimento Humano e Organizacional." },
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3">
      {FRENTES.map((f) => (
        <Link
          key={f.href}
          href={f.href}
          className="rounded-xl border border-brand-surface bg-background p-5 transition-colors hover:border-brand-primary dark:border-brand-neutral/30"
        >
          <h2 className="font-medium text-foreground">{f.titulo}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{f.descricao}</p>
        </Link>
      ))}
    </div>
  );
}
