import { z } from "zod";
import { calcularHorasExtras } from "@/lib/calc";

export const runtime = "nodejs";

const schema = z.object({
  salarioBase: z.coerce.number().positive(),
  horasMensais: z.coerce.number().positive(),
  horasExtras: z.coerce.number().positive(),
  /** 0,5 = adicional de 50%; 1 = 100% (domingo, feriado, banco de horas). */
  percentualAdicional: z.coerce.number().min(0).max(2),
  incluirDSR: z.coerce.boolean(),
  diasUteisMes: z.coerce.number().int().min(1).max(31).optional(),
  diasRepousoMes: z.coerce.number().int().min(1).max(31).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  return Response.json({ resultado: calcularHorasExtras(parsed.data) });
}
