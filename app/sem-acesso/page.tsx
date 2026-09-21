import Link from "next/link";

export const metadata = { title: "Sem acesso — Portal DP" };

export default function SemAcessoPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-danger/10 text-2xl">🔒</span>
      <h1 className="text-[16px] font-semibold text-foreground">Você não tem acesso a este módulo</h1>
      <p className="max-w-sm text-[12.5px] text-foreground-muted">
        Fale com o administrador do Portal DP se achar que deveria ver esta página.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-brand-primary px-3 py-1.5 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-800"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
