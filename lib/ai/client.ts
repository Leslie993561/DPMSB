import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cliente: Anthropic | null = null;

/**
 * A verificação da chave é feita aqui (e não no topo do módulo) para que a
 * rota consiga devolver um erro legível ao usuário em vez de derrubar o
 * módulo inteiro com um 500 opaco.
 */
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Crie um arquivo .env.local na raiz do projeto com " +
        "ANTHROPIC_API_KEY=sk-ant-... e reinicie o servidor (veja .env.example).",
    );
  }
  cliente ??= new Anthropic();
  return cliente;
}
