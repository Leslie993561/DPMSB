import { NextResponse, type NextRequest } from "next/server";
import { verificarSessao } from "@/lib/auth/token";
import { ROTAS_API, ROTAS_PAGINA, PREFIXO_ADMIN, permiteAcesso, moduloDaPagina } from "@/lib/acesso/rotas";

const NOME_COOKIE = "portaldp_sessao";
const CAMINHOS_PUBLICOS = new Set(["/login"]);

/**
 * Gate de autenticação e permissão de TODAS as páginas e rotas de API do
 * Portal DP. Só lê e valida a assinatura do cookie de sessão — nenhuma
 * consulta ao banco aqui (ver `lib/auth/token.ts` sobre o porquê).
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const ehApi = pathname.startsWith("/api/");

  if (CAMINHOS_PUBLICOS.has(pathname) || pathname.startsWith("/api/auth/")) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
