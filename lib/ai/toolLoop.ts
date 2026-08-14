import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./client";
import { systemPrompt } from "./systemPrompt";
import { tools, toolDispatch } from "./tools";

const MODEL = "claude-sonnet-5";
const MAX_TOOL_ITERATIONS = 6;

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  result: unknown;
  isError: boolean;
}

export interface ChatTurnResult {
  message: Anthropic.Message;
  toolCalls: ToolCallRecord[];
}

/**
 * Executa um turno de chat com Claude, resolvendo chamadas de ferramentas
 * (tool_use) contra o motor de cálculo determinístico em lib/calc até obter
 * uma resposta final sem tool_use pendente. Claude nunca calcula números —
 * apenas interpreta e explica os resultados retornados pelas ferramentas.
 */
export async function runChatTurn(
  userMessages: Anthropic.MessageParam[],
): Promise<ChatTurnResult> {
  const anthropic = getAnthropicClient();
  const messages: Anthropic.MessageParam[] = [...userMessages];
  const toolCalls: ToolCallRecord[] = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      return { message: response, toolCalls };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => {
      const dispatch = toolDispatch[block.name];
      if (!dispatch) {
        toolCalls.push({ tool: block.name, input: block.input, result: null, isError: true });
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: `Ferramenta desconhecida: ${block.name}`,
          is_error: true,
        };
      }
      try {
        const result = dispatch(block.input);
        toolCalls.push({ tool: block.name, input: block.input, result, isError: false });
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toolCalls.push({ tool: block.name, input: block.input, result: null, isError: true });
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: `Erro ao calcular: ${message}`,
          is_error: true,
        };
      }
    });

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(
    `Loop de ferramentas excedeu ${MAX_TOOL_ITERATIONS} iterações sem resposta final.`,
  );
}
