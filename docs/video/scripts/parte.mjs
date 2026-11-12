// Gera UMA parte do roteiro, sincronizada com o áudio dela.
//   node parte.mjs 01 capturar 1   → captura só o bloco 1
//   node parte.mjs 01 montar       → sequência + encode + áudio → preview
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, linkSync } from "node:fs";
import { resolve, join } from "node:path";

const BASE = "https://monitor-queimadas-br.vercel.app";
const FPS = 10;
const numero = String(process.argv[2] ?? "").padStart(2, "0");
const modo = process.argv[3] ?? "montar";
const indiceBloco = process.argv[4] != null ? Number(process.argv[4]) : null;
const RAIZ = resolve(".");
const ROTEIRO = join(RAIZ, "docs/video/roteiro-19-partes.md");
const TRAB = join(RAIZ, ".video/partes", numero);
const SLIDE_URL = `file://${join(RAIZ, ".video/slides", `parte-${numero}.html`)}`;
const STORY = join(TRAB, "storyboard.json");
if (!existsSync(STORY)) throw new Error(`storyboard não encontrado: ${STORY}`);

// duração estimada pela fala: 140 palavras/min + respiro final
const PPM = 140;
const textoRoteiro = readFileSync(ROTEIRO, "utf8");
const secoes = textoRoteiro.split(/^## Audio (\d+)$/m);
const falas = {};
for (let i = 1; i < secoes.length; i += 2) falas[String(secoes[i]).padStart(2, "0")] = secoes[i + 1].trim();
const fala = falas[numero];
if (!fala) throw new Error(`parte ${numero} não encontrada no roteiro`);
const palavras = fala.split(/\s+/).filter(Boolean).length;
const duracaoParte = +(palavras / PPM * 60 + 0.6).toFixed(2);

const storyboard = JSON.parse(readFileSync(STORY, "utf8"));
const OPACIDADE_ESTADOS = storyboard.estados_opacidade ?? null;
// storyboard usa frações: converte para segundos fechando exatamente na duração
const blocos = storyboard.blocos.map((b) => ({ ...b, duracao: +(duracaoParte * (b.fracao ?? 1)).toFixed(3) }));
const soma = blocos.reduce((s, b) => s + b.duracao, 0);
blocos[blocos.length - 1].duracao = +(blocos[blocos.length - 1].duracao + (duracaoParte - soma)).toFixed(3);
console.log(`parte ${numero}: ${palavras} palavras → ${duracaoParte}s`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ————— montagem (não precisa de navegador) —————
if (modo === "montar") {
  const seqDir = join(TRAB, "seq");
  rmSync(seqDir, { recursive: true, force: true });
  mkdirSync(seqDir, { recursive: true });
  const totalFrames = Math.round(duracaoParte * FPS);
  let inicio = 0, n = 0;
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    const primeiro = Math.round(inicio * FPS);
    const ultimo = Math.round((inicio + b.duracao) * FPS);
    let fontes;
    if (b.tipo === "cartao") {
      fontes = [join(RAIZ, ".video/cards", `${b.nome}.jpg`)];
    } else {
      const dir = join(TRAB, "capturas", `bloco-${i}`);
      fontes = execFileSync("ls", [dir]).toString().trim().split("\n").filter(Boolean).sort().map((f) => join(dir, f));
      if (!fontes.length) throw new Error(`sem frames no bloco ${i} — rode a captura antes`);
    }
    for (let k = primeiro; k < ultimo && k < totalFrames; k++) {
      const rel = (k - primeiro) / Math.max(1, ultimo - primeiro);
      const idx = Math.min(fontes.length - 1, Math.floor(rel * fontes.length));
      n += 1;
      try { linkSync(fontes[idx], join(seqDir, `${String(n).padStart(6, "0")}.jpg`)); } catch {}
    }
    inicio += b.duracao;
  }
  console.log(`sequência: ${n} frames (${(n / FPS).toFixed(2)}s) para fala de ${duracaoParte}s`);
  const saida = join(RAIZ, ".video/preview", `parte-${numero}.mp4`);
  mkdirSync(join(RAIZ, ".video/preview"), { recursive: true });
  execFileSync("ffmpeg", ["-y","-loglevel","error",
    "-framerate", String(FPS), "-i", join(seqDir, "%06d.jpg"),
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-c:v","libx264","-preset","medium","-crf","21","-r","30",
    "-an","-movflags","+faststart", saida], { stdio: "inherit" });
  console.log(`preview pronto: ${saida}`);
  process.exit(0);
}

// ————— captura de um bloco —————
const b = blocos[indiceBloco];
if (!b || b.tipo !== "captura") throw new Error(`bloco ${indiceBloco} não é de captura`);
const PORTA = 9600 + Number(numero);
const chrome = spawn("/usr/bin/chromium", ["--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",
  "--force-device-scale-factor=1","--window-size=1920,1080",
  `--remote-debugging-port=${PORTA}`, `--user-data-dir=${join(TRAB, "perfil")}`, "about:blank"], { stdio: "ignore" });
await esperar(3500);
const lista = await (async () => { for (let i = 0; i < 30; i++) { try { return await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json(); } catch { await esperar(500); } } throw new Error("CDP indisponível"); })();
const pagina = lista.find((t) => t.type === "page");
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const enviar = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await enviar("Page.enable");
await enviar("Runtime.enable");
await enviar("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

const js = async (expr) => (await enviar("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
const mover = (x, y) => enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
const clicarEm = async (x, y) => {
  await enviar("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await esperar(60);
  await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};
const caixaDe = (sel, texto) => js(`(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
  const el = ${texto ? `els.find(e => e.textContent.includes(${JSON.stringify(texto)}))` : "els[0]"};
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
const caixasDe = (sel) => js(`(() => [...document.querySelectorAll(${JSON.stringify(sel)})]
  .map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }))()`);
const clicarTexto = async (sel, texto) => {
  const c = await caixaDe(sel, texto); if (!c) return false;
  await mover(c.x - 130, c.y - 45); await esperar(200);
  await mover(c.x, c.y); await esperar(170);
  await clicarEm(c.x, c.y); return true;
};
const passeio = async (de, ate, passos = 16, pausa = 90) => {
  for (let i = 0; i <= passos; i++) { const t = i / passos; await mover(de.x + (ate.x - de.x) * t, de.y + (ate.y - de.y) * t); await esperar(pausa); }
};
const rolar = (dy) => enviar("Input.dispatchMouseEvent", { type: "mouseWheel", x: 640, y: 400, deltaX: 0, deltaY: dy });
// dois cliques completos em sequência = evento dblclick (Leaflet aproxima no ponto)
const zoomEm = async (alvo, vezes = 2, pausa = 1100) => {
  for (let i = 0; i < vezes; i++) {
    for (let k = 1; k <= 2; k++) {
      await enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: alvo.x, y: alvo.y, button: "left", clickCount: k });
      await esperar(30);
      await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: alvo.x, y: alvo.y, button: "left", clickCount: k });
      await esperar(60);
    }
    await esperar(pausa);
  }
};
// arrasta o mapa (pan) entre dois pontos
const arrastar = async (de, ate, passos = 14) => {
  await enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: de.x, y: de.y, button: "left", clickCount: 1 });
  await esperar(60);
  for (let i = 1; i <= passos; i++) {
    const t = i / passos;
    await enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x: de.x + (ate.x - de.x) * t, y: de.y + (ate.y - de.y) * t, button: "left", buttons: 1 });
    await esperar(28);
  }
  await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: ate.x, y: ate.y, button: "left", clickCount: 1 });
};
// zoom pelos botões do Leaflet (funciona sempre)
const zoomBotoes = async (vezes = 2, pausa = 1000) => {
  const z = await caixaDe(".leaflet-control-zoom-in");
  if (!z) return;
  for (let i = 0; i < vezes; i++) { await clicarEm(z.x, z.y); await esperar(pausa); }
};
// deixa o mapa já aproximado nos focos (executado ANTES da captura)
const prepararMapaZoom = async (niveis = 2) => {
  await esperarDados();
  await zoomBotoes(niveis, 1000);
  const marcador = await caixaDe(".leaflet-marker-icon");
  if (marcador) { await arrastar(marcador, { x: 1140, y: 540 }, 16); await esperar(900); }
};
const esperarDados = async (limite = 20000) => {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    const carregando = await js(`(() => {
      const p = document.querySelector('aside p.status');
      return !p || p.textContent.includes('Carregando');
    })()`);
    if (!carregando) { await esperar(600); return true; }
    await esperar(400);
  }
  return false;
};
// esconde as etiquetas do mapa e desenha um ponteiro de mouse visível
const injetarOverlay = async () => {
  await js(`(() => {
    if (document.getElementById('dsh-cursor')) return true;
    const estilo = document.createElement('style');
    estilo.textContent = '.leaflet-tooltip{display:none !important}'
      + '.grafico-historico__estatisticas li{transition:background .22s ease, outline-color .22s ease, transform .22s ease}'
      + '.grafico-historico__estatisticas li:hover{outline:3px solid #f59e0b;outline-offset:6px;'
      + 'background:rgba(245,158,11,.14);border-radius:12px;transform:translateY(-2px)}'
      + ${JSON.stringify(OPACIDADE_ESTADOS === null ? "" :
          `.leaflet-estados-pane path{fill-opacity:${OPACIDADE_ESTADOS} !important;`
          + `stroke-opacity:${OPACIDADE_ESTADOS < 0.2 ? 0.85 : 0.5} !important;`
          + `stroke-width:${OPACIDADE_ESTADOS < 0.2 ? 1.2 : 0.75} !important}`)};
    document.head.appendChild(estilo);
    const c = document.createElement('div');
    c.id = 'dsh-cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:34px;height:34px;pointer-events:none;z-index:99999;'
      + 'transform:translate(-200px,-200px);will-change:transform;'
      + 'filter:drop-shadow(0 2px 4px rgba(0,0,0,.55))';
    c.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24">'
      + '<path d="M4 2 L4 18 L8.6 14 L11.2 20.4 L14.4 18.8 L11.8 12.6 L17.6 12 Z" '
      + 'fill="#ffffff" stroke="#10140f" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    let alvoX = -200, alvoY = -200, atualX = -200, atualY = -200;
    document.addEventListener('mousemove', (e) => { alvoX = e.clientX; alvoY = e.clientY; }, true);
    // segue o alvo com suavização (lerp) a cada quadro
    const anima = () => {
      atualX += (alvoX - atualX) * 0.18;
      atualY += (alvoY - atualY) * 0.18;
      c.style.transform = 'translate(' + atualX.toFixed(1) + 'px,' + atualY.toFixed(1) + 'px)';
      requestAnimationFrame(anima);
    };
    requestAnimationFrame(anima);
    return true;
  })()`);
};
// zoom pela roda do mouse (como o usuário faz no scroll)
const rolarZoom = async (ponto, eventos = 8, delta = -60, pausa = 190) => {
  for (let i = 0; i < eventos; i++) {
    await enviar("Input.dispatchMouseEvent", { type: "mouseWheel", x: ponto.x, y: ponto.y, deltaX: 0, deltaY: delta });
    await esperar(pausa);
  }
};
const ir = async (url) => { await enviar("Page.navigate", { url }); await esperar(5000); await injetarOverlay(); };
// coordenadas desenhadas em 1280x720 → viewport 1920x1080
const S = 1.5;
const pt = (x, y) => ({ x: x * S, y: y * S });
// Percorre um circuito de pontos repetidamente até a duração do bloco acabar.
const circuito = async (dur, pontos, pausa = 120, passos = 10) => {
  const fim = Date.now() + dur * 1000;
  let i = 0;
  while (Date.now() < fim) {
    const de = pontos[i % pontos.length];
    const ate = pontos[(i + 1) % pontos.length];
    await passeio(de, ate, passos, pausa);
    i += 1;
  }
};
const definirEstado = async (valor) => {
  await js(`(() => { const s=[...document.querySelectorAll('aside select')][1]; s.value=${JSON.stringify(valor)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await esperar(2200);
};

// preparar = tudo que muda de tela (antes da captura); durante = movimento
const ACOES = {
  slide: {
    // slide HTML animado: a animação é do próprio CSS, basta esperar
    preparar: async () => { await enviar("Page.navigate", { url: SLIDE_URL }); await esperar(1600); await injetarOverlay(); },
    durante: async () => {},
  },
  "mapa-inicial": {
    preparar: async () => { await ir(`${BASE}/?visao=mapa`); await esperarDados(); },
    durante: async (dur) => {
      const z = await caixaDe(".leaflet-control-zoom-in");
      if (z) { await clicarEm(z.x, z.y); await esperar(1200); }
      await circuito(dur, [pt(640, 300), pt(880, 470), pt(560, 430)], 130, 9);
    },
  },
  "mapa-demo-filtros": {
    // cena única: cores por estado → painel → filtro → cidade → zoom nos focos
    preparar: async () => {
      await ir(`${BASE}/?visao=mapa&data=2026-10-28`);
      await esperar(1200);
      await prepararMapaZoom(1);   // já começa aproximado, sem zoom durante a cena
    },
    durante: async (dur) => {
      const espera = (frac) => esperar(Math.max(200, dur * frac * 1000));
      await passeio(pt(620, 300), pt(880, 400), 8, 140);
      await espera(0.04);
      await passeio(pt(880, 400), pt(210, 380), 10, 130);
      await espera(0.05);
      await definirEstado("PARÁ");
      await espera(0.06);
      const cidade = await caixaDe(".cidades__item");
      if (cidade) { await mover(cidade.x - 60, cidade.y); await esperar(250); await clicarEm(cidade.x, cidade.y); }
      await espera(0.07);
      const alvo = (await caixaDe(".leaflet-marker-icon")) ?? pt(760, 360);
      await passeio(pt(300, 470), { x: alvo.x - 50, y: alvo.y - 35 }, 10, 150);
      await circuito(Math.max(2, dur * 0.22), [
        { x: alvo.x - 50, y: alvo.y - 35 },
        { x: alvo.x + 40, y: alvo.y + 20 },
      ], 230, 5);
    },
  },
  "mapa-painel": {
    preparar: async () => { await ir(`${BASE}/?visao=mapa`); await esperarDados(); },
    durante: async () => {
      await passeio(pt(620, 300), pt(210, 250), 12, 110);
      await passeio(pt(210, 250), pt(190, 470), 10, 130);
    },
  },
  "mapa-filtro": {
    preparar: async () => { await ir(`${BASE}/?visao=mapa`); await esperarDados(); },
    durante: async () => {
      await passeio(pt(620, 300), pt(210, 380), 10, 110);
      await definirEstado("PARÁ");
      await clicarTexto(".cidades__item", "PORTEL");
      await esperar(1600);
      await passeio(pt(300, 470), pt(780, 400), 10, 130);
    },
  },
  "dashboard-intro": {
    // introdução: passa pelas três abas sem aprofundar
    preparar: async () => { await ir(`${BASE}/?visao=dashboard&data=2026-10-28`); await esperar(1200); await esperarDados(); await injetarOverlay(); await esperar(800); },
    durante: async (dur) => {
      const espera = (frac) => esperar(Math.max(200, dur * frac * 1000));
      await passeio(pt(480, 200), pt(1080, 232), 8, 130);     // cartões de resumo
      await espera(0.06);
      await passeio(pt(1080, 232), pt(520, 430), 8, 130);     // tabelas
      await espera(0.05);
      await clicarTexto(".abas__botao", "Gráficos");           // aba Gráficos
      await esperar(1300);
      await passeio(pt(440, 330), pt(860, 320), 7, 150);
      await espera(0.03);
      await clicarTexto(".abas__botao", "Histórico");          // aba Histórico
      await esperar(3400);                                      // carrega o histórico
      await passeio(pt(440, 320), pt(900, 350), 8, 160);       // cards e gráfico
      await espera(0.04);
      await passeio(pt(900, 350), pt(700, 560), 6, 160);
    },
  },
  "dashboard-hoje": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard&data=2026-10-28`); await esperar(1200); await esperarDados(); },
    durante: async () => {
      await passeio(pt(500, 210), pt(1100, 250), 12, 120);
      await passeio(pt(1100, 250), pt(430, 430), 12, 120);
      await rolar(220); await esperar(1400);
      await passeio(pt(420, 330), pt(880, 520), 10, 130);
    },
  },
  "dashboard-graficos": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard`); await esperar(2000); await clicarTexto(".abas__botao", "Gráficos"); await esperar(2800); },
    durante: async () => {
      await passeio(pt(430, 330), pt(850, 310), 12, 150);
      await passeio(pt(850, 310), pt(520, 560), 10, 150);
    },
  },
  "dashboard-historico": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard`); await esperar(2000); await clicarTexto(".abas__botao", "Histórico"); await esperar(3800); },
    durante: async () => {
      await passeio(pt(420, 320), pt(900, 340), 12, 170);
      await passeio(pt(900, 340), pt(700, 570), 10, 170);
    },
  },
  "mapa-foco-clique": {
    // contexto → dois passos de aproximação → agrupamento denso → foco → popup → filtro
    preparar: async () => {
      await ir(`${BASE}/?visao=mapa&data=2026-10-28&estado=PARÁ&municipio=URUARÁ`);
      await esperar(1200);
      await esperarDados();
      await injetarOverlay();
      await esperar(300);
    },
    durante: async (dur) => {
      const pontosDeFoco = () => js(`(() => {
        const saida = [];
        for (const e of document.querySelectorAll('.leaflet-overlay-pane path')) {
          const r = e.getBoundingClientRect();
          if (r.width < 3 || r.width > 40) continue;
          const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
          if (x < 380 || x > 1880 || y < 30 || y > 1040) continue;
          const topo = document.elementFromPoint(x, y);
          if (topo && (topo === e || e.contains(topo))) saida.push({ x, y });
        }
        return saida;
      })()`);
      // 1) contexto: Brasil com Uruará em destaque
      await passeio({ x: 980, y: 370 }, { x: 1090, y: 445 }, 3, 170);
      // 2) dois passos de aproximação SOBRE o agrupamento (mantém os focos no centro)
      const inicio = await js(`(() => {
        const lista = [...document.querySelectorAll('.marker-cluster')].map(e => {
          const n = parseInt((e.textContent || '').replace(/\D/g, ''), 10) || 0;
          const r = e.getBoundingClientRect();
          return { n, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }).filter(o => o.x > 330 && o.x < 1900 && o.y > 20 && o.y < 1060);
        lista.sort((a, b) => b.n - a.n);
        return lista[0] || null;
      })()`);
      // 2) aproxima com a RODA DO MOUSE sobre o agrupamento (zoom contínuo, como no uso real)
      // roda a roda EXATAMENTE sobre o agrupamento (o zoom do Leaflet ancora no cursor)
      if (inicio) {
        await passeio({ x: inicio.x - 50, y: inicio.y - 35 }, { x: inicio.x, y: inicio.y }, 3, 170);
        await rolarZoom({ x: inicio.x, y: inicio.y }, 2, -40, 350);
        await esperar(1400);
      }
      console.log("clusters na tela:", await js(`document.querySelectorAll('.marker-cluster').length`));
      // 3) agrupamento mais denso: abre a visão do município com as bolhas
      const denso = await js(`(() => {
        const lista = [...document.querySelectorAll('.marker-cluster')].map(e => {
          const n = parseInt((e.textContent || '').replace(/\D/g, ''), 10) || 0;
          const r = e.getBoundingClientRect();
          return { n, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        }).filter(o => o.x > 330 && o.x < 1900 && o.y > 20 && o.y < 1060);
        lista.sort((a, b) => b.n - a.n);
        return lista[0] || null;
      })()`);
      if (denso) {
        await passeio({ x: denso.x - 70, y: denso.y - 45 }, { x: denso.x, y: denso.y }, 4, 180);
        await clicarEm(denso.x, denso.y);
        await esperar(1900);
      }
      // 4) percorre as bolhas e clica num foco individual
      await passeio({ x: 950, y: 350 }, { x: 1200, y: 520 }, 5, 170);
      const pontos = await pontosDeFoco();
      const centro = { x: 1150, y: 500 };
      const ordenados = pontos.sort((a, b) =>
        (Math.abs(a.x - centro.x) + Math.abs(a.y - centro.y)) - (Math.abs(b.x - centro.x) + Math.abs(b.y - centro.y)));
      let abriu = false;
      for (const alvo of ordenados.slice(0, 3)) {
        await passeio({ x: alvo.x - 55, y: alvo.y - 40 }, alvo, 3, 190);
        await esperar(200);
        await clicarEm(alvo.x, alvo.y);
        await esperar(1300);
        abriu = await js(`!!document.querySelector('.leaflet-popup')`);
        if (abriu) break;
      }
      console.log("focos:", pontos.length, "| popup:", abriu, "| cluster denso:", denso?.n);
      // 5) botão "Filtrar por este município"
      const botao = await js(`(() => {
        const b = [...document.querySelectorAll('button')].find(e => /Filtrar por este munic/i.test(e.textContent));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()`);
      if (botao) {
        await passeio({ x: botao.x - 55, y: botao.y - 50 }, botao, 3, 200);
        await esperar(600);
        await clicarEm(botao.x, botao.y);
      }
    },
  },
  "dashboard-hoje-completo": {
    // aba Hoje inteira: último foco, cartões, tabelas, ranking, detalhamento e exportar
    preparar: async () => {
      await ir(`${BASE}/?visao=dashboard&data=2026-10-28`);
      await esperar(1200);
      await esperarDados();
      await injetarOverlay();
      await esperar(500);
    },
    durante: async (dur) => {
      await passeio(pt(500, 210), pt(1050, 235), 8, 150);    // cartões de resumo
      await esperar(500);
      await passeio(pt(1050, 235), pt(430, 300), 7, 150);    // último foco + tabelas
      await esperar(400);
      await passeio(pt(430, 300), pt(900, 330), 7, 160);     // top 15 municípios
      await esperar(400);
      await passeio(pt(900, 330), pt(1150, 320), 5, 170);    // focos por bioma/satélite
      await esperar(400);
      await passeio(pt(700, 500), pt(700, 560), 5, 170);     // detalhamento paginado
      await rolar(180);
      await esperar(600);
      const exportar = await caixaDe(".exportar");
      if (exportar) {
        await passeio({ x: exportar.x - 120, y: exportar.y + 90 }, exportar, 7, 160);
        await esperar(900);
      }
    },
  },
  "resultado-agregados": {
    // tabelas por estado/município e depois os cards de pico, menor e total
    preparar: async () => {
      await ir(`${BASE}/?visao=dashboard&data=2026-10-28`);
      await esperarDados();
      await clicarTexto(".abas__botao", "Histórico");
      await esperar(4200);                              // aquece o histórico
      await clicarTexto(".abas__botao", "Hoje");         // volta para os agregados
      await esperar(900);
      await injetarOverlay();
      await esperar(400);
    },
    durante: async (dur) => {
      await passeio(pt(430, 300), pt(980, 320), 8, 150);   // focos por estado
      await esperar(700);
      await passeio(pt(980, 320), pt(700, 330), 6, 150);   // top 15 municípios
      await esperar(600);
      await clicarTexto(".abas__botao", "Histórico");
      await esperar(1600);
      for (const c of (await caixasDe(".grafico-historico__estatisticas li")).slice(0, 3)) {
        await mover(c.x - 40, c.y - 30); await esperar(170);
        await mover(c.x, c.y); await esperar(1500);
      }
    },
  },
  "matao-comparativo": {
    // Matão: série municipal x estadual, com FRP médio
    preparar: async () => {
      await ir(`${BASE}/?visao=dashboard&data=2026-10-28&estado=SÃO PAULO&municipio=MATÃO`);
      await esperar(1200);
      await esperarDados();
      await clicarTexto(".abas__botao", "Histórico");
      await esperar(4800);                              // carrega série de Matão
      await injetarOverlay();
      await esperar(400);
    },
    durante: async (dur) => {
      for (const c of (await caixasDe(".grafico-historico__estatisticas li")).slice(0, 3)) {
        await mover(c.x - 40, c.y - 30); await esperar(170);
        await mover(c.x, c.y); await esperar(1300);
      }
      await passeio(pt(520, 470), pt(980, 480), 8, 170);   // série anual de Matão
      await passeio(pt(700, 560), pt(950, 575), 6, 180);   // linha de FRP médio
    },
  },
  "historico-navegando": {
    // pré-aquece o histórico e depois navega de verdade, com tempo para o Mensal
    preparar: async () => {
      await ir(`${BASE}/?visao=dashboard&data=2026-10-28`);
      await esperarDados();
      await clicarTexto(".abas__botao", "Histórico");
      await esperar(4500);                                    // carrega anual (fora da gravação)
      await clicarTexto(".abas--compactas .abas__botao", "Mensal");
      await esperar(2600);                                    // carrega mensal (fora da gravação)
      await ir(`${BASE}/?visao=mapa&data=2026-10-28`);         // volta ao mapa para começar a cena
      await esperarDados();
      await injetarOverlay();
      await esperar(400);
    },
    durante: async (dur) => {
      await passeio(pt(620, 300), pt(790, 385), 9, 140);      // ~1,5s de mapa
      await passeio(pt(790, 385), pt(670, 425), 6, 145);      // +1s
      await clicarTexto(".view-toggle button", "Dashboard");
      await esperar(900);
      await passeio(pt(500, 210), pt(900, 240), 4, 130);
      await clicarTexto(".abas__botao", "Gráficos");
      await esperar(1100);
      await passeio(pt(450, 330), pt(820, 320), 4, 140);
      await clicarTexto(".abas__botao", "Histórico");          // já está em cache: rápido
      await esperar(1800);
      for (const c of (await caixasDe(".grafico-historico__estatisticas li")).slice(0, 3)) {
        await mover(c.x - 40, c.y - 30); await esperar(160);
        await mover(c.x, c.y); await esperar(1150);
      }
      await clicarTexto(".abas--compactas .abas__botao", "Mensal");
      await esperar(1400);
      for (const c of (await caixasDe(".grafico-historico__estatisticas li")).slice(0, 3)) {
        await mover(c.x - 40, c.y - 30); await esperar(160);
        await mover(c.x, c.y); await esperar(1250);
      }
      await passeio(pt(600, 560), pt(900, 580), 5, 160);      // fecha no gráfico mensal
    },
  },
  "historico-nacional": {
    // aba Histórico: cards de pico/menor/total, gráfico anual e alternância para mensal
    preparar: async () => {
      await ir(`${BASE}/?visao=dashboard&data=2026-10-28`);
      await esperar(1200);
      await esperarDados();
      await clicarTexto(".abas__botao", "Histórico");
      await esperar(4200);
      await injetarOverlay();
    },
    durante: async (dur) => {
      const espera = (frac) => esperar(Math.max(200, dur * frac * 1000));
      await passeio(pt(440, 310), pt(900, 330), 8, 150);      // cards pico/menor/total
      await espera(0.10);
      await passeio(pt(900, 330), pt(520, 470), 8, 150);      // gráfico anual
      await espera(0.08);
      await passeio(pt(520, 470), pt(980, 480), 8, 150);
      await espera(0.06);
      await clicarTexto(".abas--compactas .abas__botao", "Mensal");  // série mensal
      await esperar(2600);
      await passeio(pt(440, 320), pt(900, 340), 7, 160);
      await espera(0.04);
      await passeio(pt(900, 340), pt(700, 560), 6, 160);
    },
  },
  "historico-cards": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard`); await esperar(2000); await clicarTexto(".abas__botao", "Histórico"); await esperar(3800); },
    durante: async () => {
      await passeio(pt(430, 300), pt(560, 330), 8, 200);
      await passeio(pt(560, 330), pt(940, 330), 10, 200);
    },
  },
  "historico-frp": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard&estado=PARÁ&municipio=PORTEL`); await esperar(1200); await esperarDados(); await clicarTexto(".abas__botao", "Histórico"); await esperar(3800); },
    durante: async () => {
      await passeio(pt(500, 590), pt(950, 590), 12, 170);
      await passeio(pt(950, 590), pt(700, 590), 8, 170);
    },
  },
  "mapa-zoom-foco": {
    preparar: async () => {
      await ir(`${BASE}/?visao=mapa`);
      for (let i = 0; i < 4; i++) { const c = await caixaDe(".leaflet-marker-icon.marker-cluster"); if (!c) break; await clicarEm(c.x, c.y); await esperar(900); }
      const foco = await caixaDe("path.leaflet-interactive");
      if (foco) { await mover(foco.x, foco.y); await esperar(300); await clicarEm(foco.x, foco.y); await esperar(1500); }
    },
    durante: async () => {
      const btn = await caixaDe(".popup-filtrar");
      if (btn) { await mover(btn.x, btn.y); await esperar(1200); }
      await passeio(pt(720, 380), pt(860, 470), 8, 150);
    },
  },
  "mapa-coropletico": {
    // coroplético: rampa de vermelhos por estado + legenda unificada
    preparar: async () => {
      await ir(`${BASE}/?visao=mapa&data=2026-10-28`);
      await esperar(1200);
      await prepararMapaZoom(1);
      await injetarOverlay();
      await esperar(400);
    },
    durante: async (dur) => {
      await passeio(pt(620, 290), pt(800, 360), 9, 150);      // estados em vermelho
      await esperar(600);
      await passeio(pt(800, 360), pt(690, 300), 6, 150);
      await esperar(500);
      await passeio(pt(690, 300), pt(1120, 470), 10, 150);    // desce até a legenda
      await esperar(700);
      await passeio(pt(1120, 470), pt(1142, 545), 8, 180);    // bolhas e estados
      await esperar(500);
      await passeio(pt(1142, 545), pt(1150, 640), 8, 190);    // focos — intensidade (FRP)
      await esperar(900);
      await passeio(pt(1150, 640), pt(1152, 700), 5, 210);    // até o fim da legenda
      await esperar(700);
    },
  },
  "mapa-legenda": {
    preparar: async () => { await ir(`${BASE}/?visao=mapa`); await esperarDados(); },
    durante: async () => {
      await passeio(pt(700, 350), pt(1080, 520), 12, 150);
      await passeio(pt(1080, 520), pt(1100, 610), 6, 190);
    },
  },
  "exportar-csv": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard&data=2026-10-28`); await esperar(1200); await esperarDados(); },
    durante: async () => {
      const b2 = await caixaDe(".exportar");
      if (b2) { await mover(b2.x - 80, b2.y + 60); await esperar(600); await mover(b2.x, b2.y); await esperar(1800); }
    },
  },
  "mapa-topo": {
    preparar: async () => {
      await ir(`${BASE}/?visao=mapa&data=2026-10-28`);
      await esperar(1200);
      await prepararMapaZoom(1);   // mesma aproximação da parte 04
    },
    durante: async (dur) => {
      await circuito(dur, [
        pt(625, 305), pt(700, 262), pt(762, 322),
        pt(690, 372), pt(612, 350),
      ], 150, 8);
    },
  },
  "matao-historico": {
    preparar: async () => { await ir(`${BASE}/?visao=dashboard&estado=SÃO PAULO&municipio=MATÃO`); await esperar(1200); await esperarDados(); await clicarTexto(".abas__botao", "Histórico"); await esperar(4000); },
    durante: async () => {
      await passeio(pt(420, 320), pt(880, 340), 12, 180);
      await passeio(pt(880, 340), pt(700, 560), 10, 180);
    },
  },
  "matao-mapa": {
    preparar: async () => { await ir(`${BASE}/?visao=mapa&estado=SÃO PAULO`); await esperar(2600); },
    durante: async () => {
      await passeio(pt(620, 420), pt(780, 470), 10, 150);
      const z = await caixaDe(".leaflet-control-zoom-in");
      if (z) { await clicarEm(z.x, z.y); await esperar(1200); await clicarEm(z.x, z.y); await esperar(1400); }
      await passeio(pt(700, 430), pt(760, 500), 8, 170);
    },
  },
};


const acao = ACOES[b.acao];
if (!acao) throw new Error(`ação desconhecida: ${b.acao}`);
const dir = join(TRAB, "capturas", `bloco-${indiceBloco}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

console.log(`preparando "${b.acao}"…`);
await acao.preparar();
// dispara as animações do slide exatamente quando a gravação começa
await js(`(window.__iniciar ? window.__iniciar() : null)`);
console.log("capturando…");
const frames = [];
const alvoFrames = Math.max(1, Math.round(b.duracao * FPS));
const t0 = Date.now();
const durante = (async () => { try { await acao.durante(b.duracao); } catch (e) { console.error("durante falhou:", e?.message); } })();
while (frames.length < alvoFrames) {
  const shot = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  if (shot?.data) frames.push(shot.data);
  const e = frames.length * (1000 / FPS) - (Date.now() - t0);
  if (e > 0) await esperar(e);
  if (frames.length % 40 === 0) console.log(`  ${frames.length}/${alvoFrames}`);
}
durante.catch(() => {});
frames.forEach((d, k) => writeFileSync(join(dir, `f${String(k).padStart(5, "0")}.png`), Buffer.from(d, "base64")));
console.log(`bloco ${indiceBloco}: ${frames.length} frames (${(frames.length / FPS).toFixed(2)}s)`);
ws.close(); chrome.kill("SIGKILL");
