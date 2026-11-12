// Grava os segmentos com captura determinística a FPS fixo (CDP captureScreenshot).
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const BASE = "http://localhost:4173";
const PORTA = 9402;
const FPS = 12;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(".video/seg", { recursive: true, force: true });
rmSync(".video/perfil", { recursive: true, force: true });
const chrome = spawn("/usr/bin/chromium", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--window-size=1280,720",
  `--remote-debugging-port=${PORTA}`, "--user-data-dir=.video/perfil", "about:blank",
], { stdio: "ignore" });
await esperar(3000);

const lista = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
const pagina = lista.find((t) => t.type === "page");
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pendentes = new Map();
const enviar = (method, params = {}) =>
  new Promise((r) => { const i = ++id; pendentes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pendentes.has(msg.id)) { pendentes.get(msg.id)(msg.result); pendentes.delete(msg.id); }
};

await enviar("Page.enable");
await enviar("Runtime.enable");
await enviar("Browser.setDownloadBehavior", { behavior: "deny" });
await enviar("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const js = async (expr) => {
  const r = await enviar("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};
const mover = (x, y) => enviar("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
const clicarEm = async (x, y) => {
  await enviar("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await esperar(60);
  await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};
const caixaDe = (seletor, texto) => js(`(() => {
  const els = [...document.querySelectorAll(${JSON.stringify(seletor)})];
  const el = ${texto ? `els.find(e => e.textContent.includes(${JSON.stringify(texto)}))` : "els[0]"};
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
})()`);
const clicarTexto = async (seletor, texto) => {
  const c = await caixaDe(seletor, texto);
  if (!c) return false;
  await mover(c.x - 140, c.y - 50); await esperar(200);
  await mover(c.x, c.y); await esperar(180);
  await clicarEm(c.x, c.y);
  return true;
};
const passeio = async (de, ate, passos = 20, pausa = 80) => {
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    await mover(de.x + (ate.x - de.x) * t, de.y + (ate.y - de.y) * t);
    await esperar(pausa);
  }
};
const rolar = (dy) => enviar("Input.dispatchMouseEvent", { type: "mouseWheel", x: 640, y: 400, deltaX: 0, deltaY: dy });

async function gravarSegmento(nome, duracaoSeg, acoes) {
  mkdirSync(`.video/seg/${nome}/frames`, { recursive: true });
  const frames = [];
  let parar = false;
  const t0 = Date.now();
  const loop = (async () => {
    while (!parar) {
      const alvo = (Date.now() - t0) / 1000;
      const shot = await enviar("Page.captureScreenshot", { format: "jpeg", quality: 82 });
      if (shot?.data) frames.push({ ts: +((Date.now() - t0) / 1000).toFixed(3), dados: shot.data });
      const proximo = (frames.length + 1) * (1000 / FPS);
      const espera = proximo - (Date.now() - t0);
      if (espera > 0) await esperar(espera);
      if (alvo >= duracaoSeg) parar = true;
    }
  })();
  const acoesLimitadas = (async () => {
    try { await acoes(); } catch { /* segue */ }
  })();
  const cronometro = esperar(duracaoSeg * 1000);
  await Promise.race([Promise.all([acoesLimitadas, cronometro]), cronometro]);
  parar = true;
  await loop;
  frames.forEach((f, i) =>
    writeFileSync(`.video/seg/${nome}/frames/f${String(i).padStart(5, "0")}.jpg`, Buffer.from(f.dados, "base64")));
  writeFileSync(`.video/seg/${nome}/manifest.json`, JSON.stringify({
    nome, duracao: duracaoSeg, total: frames.length,
    timestamps: frames.map((f) => f.ts),
  }));
  console.log(`${nome}: ${frames.length} frames | ${(frames.at(-1)?.ts ?? 0).toFixed(1)}s | alvo ${duracaoSeg}s`);
}

// ——— S1: mapa (justificativa) ———
await enviar("Page.navigate", { url: `${BASE}/?visao=mapa` });
await esperar(5500);
await gravarSegmento("s1-mapa", 33, async () => {
  await passeio({ x: 620, y: 300 }, { x: 900, y: 480 }, 22, 120);
  const zin = await caixaDe(".leaflet-control-zoom-in");
  await clicarEm(zin.x, zin.y); await esperar(1500);
  await passeio({ x: 500, y: 300 }, { x: 800, y: 500 }, 16, 140);
  const zout = await caixaDe(".leaflet-control-zoom-out");
  await clicarEm(zout.x, zout.y); await esperar(1600);
  await passeio({ x: 800, y: 450 }, { x: 600, y: 350 }, 14, 130);
});

// ——— S2: filtro por estado e cidade (objetivo) ———
await gravarSegmento("s2-filtros", 31.5, async () => {
  await js(`(() => { const s=[...document.querySelectorAll('aside select')][1]; s.value='PARÁ'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await esperar(2000);
  await passeio({ x: 200, y: 320 }, { x: 240, y: 430 }, 10, 150);
  await clicarTexto(".cidades__item", "PORTEL");
  await esperar(2000);
  await passeio({ x: 260, y: 430 }, { x: 700, y: 380 }, 16, 140);
  await passeio({ x: 700, y: 380 }, { x: 300, y: 520 }, 12, 140);
});

// ——— S3: dashboard Hoje (metodologia) ———
await gravarSegmento("s3-dashboard", 41.5, async () => {
  await clicarTexto(".view-toggle button", "Dashboard");
  await esperar(2600);
  await passeio({ x: 500, y: 210 }, { x: 1100, y: 250 }, 14, 150);
  await passeio({ x: 1100, y: 250 }, { x: 420, y: 430 }, 14, 150);
  await rolar(240); await esperar(1600);
  await passeio({ x: 400, y: 320 }, { x: 900, y: 520 }, 14, 150);
  await rolar(-160); await esperar(1200);
});

// ——— S4: gráficos (stack) ———
await gravarSegmento("s4-graficos", 31.5, async () => {
  await clicarTexto(".abas__botao", "Gráficos");
  await esperar(2800);
  await passeio({ x: 420, y: 330 }, { x: 850, y: 310 }, 13, 170);
  await passeio({ x: 850, y: 310 }, { x: 500, y: 570 }, 13, 170);
  await passeio({ x: 500, y: 570 }, { x: 900, y: 530 }, 11, 170);
});

// ——— S5: histórico anual (resultado) ———
await gravarSegmento("s5-historico", 51.5, async () => {
  await clicarTexto(".abas__botao", "Histórico");
  await esperar(3600);
  await passeio({ x: 400, y: 310 }, { x: 560, y: 340 }, 10, 200);
  await passeio({ x: 560, y: 340 }, { x: 920, y: 340 }, 12, 200);
  await passeio({ x: 920, y: 340 }, { x: 700, y: 570 }, 12, 200);
  await passeio({ x: 700, y: 570 }, { x: 980, y: 580 }, 10, 200);
});

// ——— S6: mensal, voltar e mapa final ———
await gravarSegmento("s6-final", 55, async () => {
  await clicarTexto(".abas--compactas .abas__botao", "Mensal");
  await esperar(3000);
  await passeio({ x: 600, y: 340 }, { x: 1000, y: 350 }, 12, 190);
  await passeio({ x: 1000, y: 350 }, { x: 700, y: 570 }, 10, 190);
  await clicarTexto(".abas__botao", "Hoje");
  await esperar(2200);
  await passeio({ x: 700, y: 160 }, { x: 1180, y: 45 }, 12, 170);
  await clicarTexto(".view-toggle button", "Mapa");
  await esperar(3000);
  await passeio({ x: 600, y: 360 }, { x: 850, y: 460 }, 14, 180);
});

ws.close();
chrome.kill("SIGKILL");
console.log("gravação concluída");
