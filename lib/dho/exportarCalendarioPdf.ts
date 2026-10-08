/**
 * Exporta o Calendário do ENDO como PDF de uma página (Carta, retrato), no
 * mesmo modelo do calendário anual da MSB: 12 meses em 3 colunas, dias com
 * data comemorativa/ação marcados e a lista "DD/MM - Nome ( Categoria )"
 * embaixo de cada mês, numeral do ano grande ao fundo e logo no canto.
 *
 * Só roda no navegador: desenha num <canvas> e embute o JPEG num PDF mínimo.
 */

export interface DataParaPdf {
  data: string;
  nome: string;
  categoria: "nacional" | "regional" | "ponte";
}

export interface AcaoParaPdf {
  data: string;
  dataFim: string | null;
  titulo: string;
}

const LARGURA_PT = 612;
const ALTURA_PT = 792;
const ESCALA = 3; // 1836 × 2376 px ≈ 216 dpi

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const COR_MES = "#5aa0b2";
const COR_NUMERO = "#2b3f47";
const COR_MARCA_FORTE = "#79b1c0";
const COR_MARCA_SUAVE = "#c3e1ee";
const COR_MARCA_ACAO = "#4a8fa3";
const COR_MARCA_D = "#dfeef2";
const COR_NOTA = "#6b7a82";

const ROTULO_CATEGORIA: Record<DataParaPdf["categoria"], string> = {
  nacional: "Nacional",
  regional: "Regional",
  ponte: "Facultativo",
};

type Marca = "forte" | "suave" | "acao";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (ano: number, mes: number, dia: number) => `${ano}-${pad(mes)}-${pad(dia)}`;
const ddmm = (dataIso: string) => `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;

/** Datas AAAA-MM-DD de início a fim (inclusive) — ação pode durar mais de um dia. */
function diasDoIntervalo(inicio: string, fim: string | null): string[] {
  const dias: string[] = [];
  const f = new Date(`${(fim && fim >= inicio ? fim : inicio)}T00:00:00Z`);
  for (let d = new Date(`${inicio}T00:00:00Z`); d <= f && dias.length < 62; d = new Date(d.getTime() + 86400000)) {
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderizarCalendario(ano: number, datas: DataParaPdf[], acoes: AcaoParaPdf[]): Promise<HTMLCanvasElement> {
  const familia = getComputedStyle(document.body).fontFamily || "sans-serif";
  try {
    await Promise.all(["400", "500", "600", "700"].map((p) => document.fonts.load(`${p} 20px ${familia}`)));
  } catch {
    /* sem a fonte da marca cai na fonte do sistema — o PDF sai igual, só muda o desenho das letras */
  }
  const logo = await carregarImagem("/logo-msb.png");

  const canvas = document.createElement("canvas");
  canvas.width = LARGURA_PT * ESCALA;
  canvas.height = ALTURA_PT * ESCALA;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ESCALA, ESCALA);
  const fonte = (peso: number, tamanho: number) => `${peso} ${tamanho}px ${familia}`;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LARGURA_PT, ALTURA_PT);

  // Ondas finas ao fundo (canto superior direito e inferior esquerdo).
  ctx.strokeStyle = COR_MARCA_D;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(430 + i * 6, 0);
    ctx.bezierCurveTo(470 + i * 8, 40, 400 + i * 10, 80, 612, 70 + i * 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 600 + i * 6);
    ctx.bezierCurveTo(60 + i * 5, 650 + i * 4, 40, 740, 90 + i * 8, 792);
    ctx.stroke();
  }

  // Numerais grandes do ano ao fundo: "20" no alto à esquerda, "AA" embaixo à direita.
  const anoTxt = String(ano);
  ctx.fillStyle = COR_MARCA_D;
  ctx.textBaseline = "alphabetic";
  ctx.font = fonte(700, 232);
  ctx.textAlign = "left";
  ctx.fillText(anoTxt.slice(0, 2), -22, 204);
  ctx.textAlign = "right";
  ctx.fillText(anoTxt.slice(2), 655, 812);

  // Marcas por dia + lista de legendas por mês.
  const marcas = new Map<string, Marca>();
  const notasPorMes: { dia: string; rotulo: string; texto: string }[][] = Array.from({ length: 12 }, () => []);
  const forca: Record<Marca, number> = { suave: 1, acao: 2, forte: 3 };
  const marcar = (dia: string, m: Marca) => {
    const atual = marcas.get(dia);
    if (!atual || forca[m] > forca[atual]) marcas.set(dia, m);
  };
  for (const d of datas) {
    if (!d.data.startsWith(`${ano}-`)) continue;
    marcar(d.data, d.categoria === "ponte" ? "suave" : "forte");
    notasPorMes[Number(d.data.slice(5, 7)) - 1].push({ dia: d.data, rotulo: ddmm(d.data), texto: `${d.nome} ( ${ROTULO_CATEGORIA[d.categoria]} )` });
  }
  for (const a of acoes) {
    for (const dia of diasDoIntervalo(a.data, a.dataFim)) if (dia.startsWith(`${ano}-`)) marcar(dia, "acao");
    if (!a.data.startsWith(`${ano}-`)) continue;
    const intervalo = a.dataFim && a.dataFim > a.data ? `${ddmm(a.data)} a ${ddmm(a.dataFim)}` : ddmm(a.data);
    notasPorMes[Number(a.data.slice(5, 7)) - 1].push({ dia: a.data, rotulo: intervalo, texto: a.titulo });
  }

  // Centros e alturas medidos no modelo (a grade dele não é perfeitamente regular).
  const centrosX = [127, 310, 490, 117, 297, 479, 125, 307, 487, 127, 307, 488];
  const topoTitulo = [43, 237, 437, 620];
  const passoDia = 21.5;

  for (let m = 0; m < 12; m++) {
    const cx = centrosX[m];
    const ty = topoTitulo[Math.floor(m / 3)];

    ctx.fillStyle = COR_MES;
    ctx.textAlign = "center";
    ctx.font = fonte(700, 16);
    ctx.letterSpacing = "2.6px";
    ctx.fillText(MESES[m], cx, ty);
    ctx.letterSpacing = "0px";

    ctx.font = fonte(700, 10);
    ctx.fillStyle = COR_MES;
    DIAS_SEMANA.forEach((d, i) => ctx.fillText(d, cx + (i - 3) * passoDia, ty + 32));

    const primeiro = new Date(ano, m, 1).getDay();
    const ultimo = new Date(ano, m + 1, 0).getDate();
    for (let dia = 1; dia <= ultimo; dia++) {
      const posicao = primeiro + dia - 1;
      const x = cx + ((posicao % 7) - 3) * passoDia;
      const y = ty + 50.5 + Math.floor(posicao / 7) * 17.3;
      const marca = marcas.get(iso(ano, m + 1, dia));
      if (marca) {
        ctx.beginPath();
        ctx.arc(x, y - 3.8, 7, 0, Math.PI * 2);
        if (marca === "acao") {
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = COR_MARCA_ACAO;
          ctx.stroke();
        } else {
          ctx.fillStyle = marca === "forte" ? COR_MARCA_FORTE : COR_MARCA_SUAVE;
          ctx.fill();
        }
      }
      ctx.fillStyle = COR_NUMERO;
      ctx.font = fonte(400, 10.5);
      ctx.fillText(String(dia), x, y);
    }

    // Legendas do mês: "DD/MM - Nome ( Categoria )"; ação entra só com o título.
    const notas = notasPorMes[m].sort((a, b) => a.dia.localeCompare(b.dia));
    const passoNota = Math.min(7.9, 36 / Math.max(notas.length, 1));
    const tamanhoNota = Math.min(6.2, passoNota * 0.8);
    ctx.textAlign = "left";
    const xNota = cx - 3.5 * passoDia + 2;
    notas.forEach((n, i) => {
      const y = ty + 147 + i * passoNota;
      ctx.font = fonte(700, tamanhoNota);
      ctx.fillStyle = COR_MES;
      ctx.fillText(n.rotulo, xNota, y);
      const larguraData = ctx.measureText(n.rotulo).width;
      ctx.font = fonte(400, tamanhoNota);
      ctx.fillStyle = COR_NOTA;
      ctx.fillText(` - ${n.texto}`, xNota + larguraData, y);
    });
  }

  if (logo) {
    // Marca "msb" (parte de cima do arquivo) + legenda ao lado, como no modelo.
    const alturaMarca = logo.naturalHeight * 0.72;
    ctx.drawImage(logo, 0, 0, logo.naturalWidth, alturaMarca, 497, 752, 76, (76 * alturaMarca) / logo.naturalWidth);
    ctx.fillStyle = COR_MES;
    ctx.textAlign = "left";
    ctx.font = fonte(500, 6.2);
    ["Medical", "System", "do Brasil"].forEach((linha, i) => ctx.fillText(linha, 578, 763 + i * 8));
  }
  return canvas;
}

/** PDF de uma página com a imagem JPEG ocupando a folha inteira. */
function montarPdf(jpeg: Uint8Array, larguraPx: number, alturaPx: number): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let tamanho = 0;
  const empurrar = (p: Uint8Array | string) => {
    const bytes = typeof p === "string" ? enc.encode(p) : p;
    partes.push(bytes);
    tamanho += bytes.length;
  };
  const objeto = (n: number, corpo: Uint8Array | string, antes = "", depois = "") => {
    offsets[n] = tamanho;
    empurrar(`${n} 0 obj\n${antes}`);
    empurrar(corpo);
    empurrar(`${depois}\nendobj\n`);
  };

  empurrar("%PDF-1.4\n");
  objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objeto(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA_PT} ${ALTURA_PT}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
  );
  const conteudo = `q ${LARGURA_PT} 0 0 ${ALTURA_PT} 0 0 cm /Im0 Do Q`;
  objeto(4, conteudo, `<< /Length ${conteudo.length} >>\nstream\n`, "\nendstream");
  objeto(
    5,
    jpeg,
    `<< /Type /XObject /Subtype /Image /Width ${larguraPx} /Height ${alturaPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    "\nendstream",
  );

  const xref = tamanho;
  let tabela = `xref\n0 6\n0000000000 65535 f \n`;
  for (let n = 1; n <= 5; n++) tabela += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  empurrar(`${tabela}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const saida = new Uint8Array(tamanho);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

export async function baixarCalendarioPdf(canvas: HTMLCanvasElement, ano: number): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.93));
  if (!blob) throw new Error("Não foi possível gerar a imagem do calendário.");
  const pdf = montarPdf(new Uint8Array(await blob.arrayBuffer()), canvas.width, canvas.height);
  const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Calendario-ENDO-${ano}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportarCalendarioPdf(ano: number, datas: DataParaPdf[], acoes: AcaoParaPdf[]): Promise<void> {
  await baixarCalendarioPdf(await renderizarCalendario(ano, datas, acoes), ano);
}
