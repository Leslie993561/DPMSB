import { Suspense } from "react";
import { FolhaPageClient } from "@/components/modules/folha/FolhaPageClient";

export const metadata = { title: "Breakdown de Folha — Portal Recursos Humanos" };

export default function FolhaPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-foreground-muted">Carregando...</p>}>
        <FolhaPageClient />
      </Suspense>
    </div>
  );
}
