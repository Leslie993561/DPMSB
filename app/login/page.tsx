import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar — Portal Recursos Humanos" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-hairline bg-background shadow-drawer">
        <div className="border-b border-hairline px-6 py-5">
          {/* next/img puro: ver comentário em components/nav/Logo.tsx */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-msb.png" alt="MSB" width={104} height={32} className="block" />
          <div className="mt-4 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <span className="text-[13.5px] font-bold tracking-tight text-foreground">Portal Recursos Humanos</span>
          </div>
          <p className="mt-0.5 pl-3 text-[11px] text-brand-neutral">Departamento Pessoal</p>
        </div>

        <div className="px-6 py-5">
          <h1 className="text-[15px] font-semibold text-foreground">Acessar o portal</h1>
          <p className="mt-1 text-[12px] text-foreground-muted">
            Entre com o seu e-mail corporativo. Apenas gestores liberados pelo administrador têm acesso.
          </p>
          <div className="mt-4">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
