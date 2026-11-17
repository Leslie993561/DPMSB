import { Suspense } from "react";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { DocDpPageClient } from "@/components/modules/doc-dp/DocDpPageClient";

export const metadata = { title: "Doc. DP — Portal Recursos Humanos" };

export default async function DocDpPage() {
  const admin = (await obterSessaoAtual())?.tipo === "administrador";
  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-foreground-muted">Carregando...</p>}>
        <DocDpPageClient admin={admin} />
      </Suspense>
    </div>
  );
}
