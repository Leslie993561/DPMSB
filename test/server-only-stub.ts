/**
 * Stub de `server-only` para os testes.
 *
 * O pacote real lança ao ser importado fora de um Server Component, o que
 * impede testar módulos puros que apenas se protegem de virar bundle de
 * cliente — como o parser de verbas da folha. O alias vale só no vitest: em
 * produção o pacote de verdade continua valendo, e a proteção segue de pé.
 */
export {};
