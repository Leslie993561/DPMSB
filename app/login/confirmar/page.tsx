import { Suspense } from "react";
import { ConfirmarEntrada } from "./ConfirmarEntrada";

export const metadata = { title: "Confirmar entrada — Portal Recursos Humanos" };

export default function ConfirmarPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-hairline bg-background px-6 py-6 shadow-drawer">
        <h1 className="text-[15px] font-semibold text-foreground">Confirmar entrada</h1>
        <Suspense>
          <ConfirmarEntrada />
        </Suspense>
      </div>
    </div>
  );
}
