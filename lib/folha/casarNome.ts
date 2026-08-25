/**
 * Casamento de nome entre a planilha do DP e o cadastro.
 *
 * A comparação literal derrubava linhas por diferenças que não mudam quem é a
 * pessoa: acento ("PATRÍCIO FÉ" x "Patricio Fe"), conectivo faltando ("ELIVÃ
 * NATIVIDADE" x "Elivã Da Natividade") e espaço sobrando no cadastro.
 *
 * O que NÃO se faz aqui é adivinhar: se a forma reduzida casar com mais de uma
 * pessoa, ninguém é escolhido — é melhor a linha ser recusada com um motivo do
 * que o valor cair no colaborador errado e ninguém notar.
 */

const CONECTIVOS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** Sem acento, sem pontuação, em minúsculas e com um espaço só entre palavras. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Só as palavras que identificam a pessoa — conectivos fora. */
export function nomeReduzido(nome: string): string {
  return normalizarNome(nome)
    .split(" ")
    .filter((palavra) => palavra && !CONECTIVOS.has(palavra))
    .join(" ");
}

export interface ResultadoCasamento<T> {
  encontrado: T | null;
  /** true quando a forma reduzida bate com mais de uma pessoa — não se escolhe nenhuma. */
  ambiguo: boolean;
}

/**
 * Procura o colaborador pelo nome, em duas passadas: primeiro exato (já sem
 * acento e espaço extra), depois ignorando conectivos.
 */
export function casarPorNome<T>(
  nomeProcurado: string,
  candidatos: T[],
  nomeDe: (candidato: T) => string,
): ResultadoCasamento<T> {
  const alvo = normalizarNome(nomeProcurado);
  if (!alvo) return { encontrado: null, ambiguo: false };

  const exatos = candidatos.filter((c) => normalizarNome(nomeDe(c)) === alvo);
  if (exatos.length === 1) return { encontrado: exatos[0], ambiguo: false };
  if (exatos.length > 1) return { encontrado: null, ambiguo: true };

  const alvoReduzido = nomeReduzido(nomeProcurado);
  const reduzidos = candidatos.filter((c) => nomeReduzido(nomeDe(c)) === alvoReduzido);
  if (reduzidos.length === 1) return { encontrado: reduzidos[0], ambiguo: false };

  return { encontrado: null, ambiguo: reduzidos.length > 1 };
}
