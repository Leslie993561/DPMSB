import { redirect } from "next/navigation";

// A frente DHO só tem o módulo Endomarketing por enquanto — a raiz cai direto
// nele em vez de mostrar uma página vazia. Quando entrar o próximo módulo
// (treinamento, clima, avaliação de desempenho) isso vira uma escolha de
// verdade.
export default function DhoPage() {
  redirect("/dho/endomarketing");
}
