/**
 * Detecção de valor "quase igual" a um já existente — o typo de digitação que
 * cria um departamento novo sem ninguém perceber.
 *
 * Caso real: a planilha-mestre trouxe "mantenção" e o portal passou a listar
 * esse setor ao lado de "Manutenção", com uma pessoa em cada. A diferença é uma
 * letra; nenhuma normalização de acento pega isso.
 *
 * Aqui só se AVISA. Juntar automaticamente seria pior: "Vendas" e "Operações de
 * Vendas" são parecidos e podem ser setores diferentes de verdade — quem decide
 * é quem conhece a estrutura.
 */

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Distância de edição, limitada: acima de `teto` para de contar e devolve teto+1. */
export function distanciaEdicao(a: string, b: string, teto = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > teto) return teto + 1;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(
        anterior[j] + 1,
        atual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    if (Math.min(...atual) > teto) return teto + 1;
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * Devolve o valor existente que é quase igual ao novo — ou null.
 *
 * O teto cresce com o tamanho da palavra: uma letra a mais em "mantenção" é
 * typo, mas uma letra de diferença entre "RH" e "PH" pode ser outro setor.
 */
export function acharParecido(novo: string, existentes: string[]): string | null {
  const alvo = normalizar(novo);
  if (alvo.length < 5) return null;

  const teto = alvo.length >= 10 ? 2 : 1;
  for (const existente of existentes) {
    const outro = normalizar(existente);
    if (outro === alvo) return null; // igual não é parecido
    if (distanciaEdicao(alvo, outro, teto) <= teto) return existente;
  }
  return null;
}
