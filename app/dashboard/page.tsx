import { DashboardFeriasClient } from "@/components/modules/dashboard/DashboardFeriasClient";

export const metadata = { title: "Dashboard — Portal Recursos Humanos" };

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-foreground-muted">
        Cálculos trabalhistas rodam em um motor determinístico auditável; a IA atua apenas na
        interpretação, explicação e sinalização de riscos — nunca faz contas por conta própria.
      </p>
      <DashboardFeriasClient />
    </div>
  );
}
