import Link from "next/link";
import { PortalDpResumo } from "@/components/modules/home/PortalDpResumo";

const OUTRAS_FRENTES = [
  { href: "/sst", titulo: "Portal SST", descricao: "Segurança e Saúde no Trabalho: EPI, exames, fardamento e acessos." },
  { href: "/dho", titulo: "Portal DHO", descricao: "Desenvolvimento Humano e Organizacional." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-3">
      <PortalDpResumo />

      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {OUTRAS_FRENTES.map((f) => (
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
    </div>
  );
}
