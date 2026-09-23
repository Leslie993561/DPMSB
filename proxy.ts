import { NextResponse, type NextRequest } from "next/server";
import { verificarSessao } from "@/lib/auth/token";
import { ROTAS_API, ROTAS_PAGINA, PREFIXO_ADMIN, permiteAcesso, moduloDaPagina } from "@/lib/acesso/rotas";

const NOME_COOKIE = "portaldp_sessao";
const CAMINHOS_PUBLICOS = new Set(["/login"]);

/**
 * Gate de autenticação e permissão de TODAS as páginas e rotas de API do
 * Portal Recursos Humanos. Só lê e valida a assinatura do cookie de sessão — nenhuma
 * consulta ao banco aqui (ver `lib/auth/token.ts` sobre o porquê).
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const ehApi = pathname.startsWith("/api/");

  // Link de auto-cadastro (/convite/[token] e sua API): quem preenche não
  // tem login no portal — o token na URL já é a credencial, validado dentro
  // da própria rota (ver app/api/convites/token/[token]/route.ts).
  if (
    CAMINHOS_PUBLICOS.has(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/convite/") ||
    pathname.startsWith("/api/convites/token/") ||
    // Ficha de EPI para o colaborador assinar: mesma lógica do convite (token
    // na URL + e-mail profissional conferido dentro da rota).
    pathname.startsWith("/assinatura-epi/") ||
    pathname.startsWith("/api/assinatura-epi/")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(NOME_COOKIE)?.value;
  const segredo = process.env.AUTH_SECRET;
  const sessao = token && segredo ? await verificarSessao(token, segredo) : null;

  if (!sessao) {
    if (ehApi) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    destino.searchParams.set("proximo", pathname);
    return NextResponse.redirect(destino);
  }

  if (sessao.tipo === "administrador") return NextResponse.next();

  // Daqui pra baixo, gestor comum — sujeito às permissões gravadas na sessão.
  if (pathname === PREFIXO_ADMIN || pathname.startsWith(`${PREFIXO_ADMIN}/`)) {
    return NextResponse.json({ erro: "Só administradores gerenciam acesso." }, { status: 403 });
  }

  // O SST tem login próprio (Supabase) e é restrito ao RH; nenhum gestor tem
  // módulo liberado lá, então o portal já barra antes de servir o app.
  if (pathname === "/sst" || pathname.startsWith("/sst/")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/sem-acesso";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  const liberados = new Set(sessao.liberados);

  if (ehApi) {
    const regra = ROTAS_API.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`));
    if (regra && !permiteAcesso(regra.modulo, liberados)) {
      return NextResponse.json({ erro: "Sem permissão para este módulo." }, { status: 403 });
    }
    return NextResponse.next();
  }

  const regraPagina = ROTAS_PAGINA.find((r) => r.caminho === pathname);
  if (regraPagina) {
    const modulo = moduloDaPagina(regraPagina, searchParams.get("aba"));
    if (modulo && !permiteAcesso(modulo, liberados)) {
      const destino = request.nextUrl.clone();
      destino.pathname = "/sem-acesso";
      destino.search = "";
      return NextResponse.redirect(destino);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Imagens de /public (logo) ficam fora: sem isso o logo quebrava nas telas
  // públicas — link de assinatura, convite e login — para quem não tem sessão.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
