<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Foco } from "../types";

const props = defineProps<{ focos: Foco[] }>();

const emit = defineEmits<{
  "filtrar-municipio": [alvo: { municipio: string; estado: string }];
}>();

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let cluster: L.MarkerClusterGroup | null = null;
let camadaEstados: L.GeoJSON | null = null;
let geojsonBrasil: GeoJSON.FeatureCollection | null = null;

// Limites do território brasileiro: a navegação (arrastar/zoom) fica
// presa dentro desta caixa.
const limitesBrasil = L.latLngBounds([-34.2, -75.2], [6.0, -32.8]);

function contagensPorEstado(): Record<string, number> {
  const contagens: Record<string, number> = {};
  for (const foco of props.focos) {
    const estado = (foco.estado || "").trim();
    if (!estado) continue;
    contagens[estado] = (contagens[estado] ?? 0) + 1;
  }
  return contagens;
}

// Rampa dos estados: gradação apenas de vermelho, do mais claro
// (poucos focos) ao vermelho escuro (muitos focos) — sem laranja e
// sem bordô quase preto no limite.
const PARADAS_COR: [number, number, number][] = [
  [252, 165, 165], // vermelho bem claro (rosado, G=B)
  [185, 28, 28], // vermelho escuro
];

function corDeEstado(focos: number, maximo: number): string {
  // Estado sem focos: branco com um pouco mais de tom rosado.
  if (!focos) return "rgb(252, 222, 220)";
  // Escala logarítmica interpolada entre as paradas da rampa.
  const forca = maximo ? Math.log10(focos + 1) / Math.log10(maximo + 1) : 0;
  const t = forca * (PARADAS_COR.length - 1);
  const i = Math.min(Math.floor(t), PARADAS_COR.length - 2);
  const f = t - i;
  const de = PARADAS_COR[i];
  const para = PARADAS_COR[i + 1];
  const rgb = de.map((v, k) => Math.round(v + (para[k] - v) * f));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// Estiliza o mapa geral: cada estado é pintado pela quantidade de focos
// do recorte atual (o mapa coroplético passa a ser a base do mapa).
function estilizarEstados() {
  if (!camadaEstados) return;
  const contagens = contagensPorEstado();
  const maximo = Math.max(0, ...Object.values(contagens));
  camadaEstados.setStyle((feicao) => {
    const nome =
      ((feicao?.properties as { name?: string } | undefined)?.name ?? "").toUpperCase();
    return {
      fillColor: corDeEstado(contagens[nome] ?? 0, maximo),
      fillOpacity: 1,
      color: "rgb(86, 96, 80)",
      weight: 0.75,
    };
  });
}

async function carregarEstados() {
  try {
    const resposta = await fetch("/dados/estados-brasil.geojson");
    if (!resposta.ok) return; // sem camada estilizada: mapa continua útil
    geojsonBrasil = (await resposta.json()) as GeoJSON.FeatureCollection;
    if (!map) return;
    camadaEstados = L.geoJSON(geojsonBrasil, {
      // Painel próprio abaixo dos marcadores (overlayPane = 400).
      pane: "estados",
      style: () => ({
        fillColor: corDeEstado(0, 0),
        fillOpacity: 1,
        color: "rgb(86, 96, 80)",
        weight: 0.75,
      }),
      onEachFeature: (feicao, camadaFeicao) => {
        const nome = (feicao.properties as { name?: string }).name ?? "";
        // Função (não string): o total é recalculado a cada hover, com os
        // focos do recorte atual — antes o texto congelava em 0.
        camadaFeicao.bindTooltip(
          () => {
            const total = contagensPorEstado()[nome.toUpperCase()] ?? 0;
            const rotulo = total === 1 ? "foco" : "focos";
            return `${nome}: ${total.toLocaleString("pt-BR")} ${rotulo} no recorte`;
          },
          { sticky: true },
        );
      },
    }).addTo(map);
    // A camada de estados é adicionada antes do cluster: os focos
    // continuam por cima, e o zoom/arrasto seguem normais.
    estilizarEstados();
  } catch {
    // Sem GeoJSON: mapa segue com fundo simples.
  }
}

function frpColor(frp: number | null): string {
  if (frp == null) return "#f59e0b";
  if (frp >= 100) return "#b91c1c";
  if (frp >= 40) return "#ef4444";
  return "#f59e0b";
}

function popupHtml(foco: Foco, destacado = false): string {
  const risco =
    foco.riscoFogo == null ? "—" : foco.riscoFogo.toFixed(2);
  const frp = foco.frp == null ? "—" : `${foco.frp.toFixed(1)} MW`;
  const chuva =
    foco.diasSemChuva == null ? "—" : String(foco.diasSemChuva);
  const precip =
    foco.precipitacao == null ? "—" : `${foco.precipitacao.toFixed(1)} mm`;

  return `
    ${destacado ? "<em><strong>★ Maior FRP do recorte</strong></em><br />" : ""}
    <strong>${foco.municipio} / ${foco.estado}</strong><br />
    Bioma: ${foco.bioma || "—"}<br />
    Satélite: ${foco.satelite}<br />
    Data/hora (GMT): ${foco.dataHoraGmt}<br />
    FRP: ${frp}<br />
    Risco de fogo: ${risco}<br />
    Dias sem chuva: ${chuva}<br />
    Precipitação: ${precip}
    <button type="button" class="popup-filtrar"
      data-municipio="${foco.municipio}"
      data-estado="${foco.estado}">
      Filtrar por este município
    </button>
  `;
}

function renderMarkers(focos: Foco[]) {
  if (!cluster) return;
  cluster.clearLayers();

  // Foco com maior FRP do recorte: destaque visual para comparação
  // com as cores do coroplético.
  const focoMaximo = focos.reduce<Foco | null>((maior, f) => {
    if (f.frp == null) return maior;
    if (!maior || (maior.frp ?? -1) < f.frp) return f;
    return maior;
  }, null);

  const markers = focos.map((foco) => {
    const destacado = foco === focoMaximo && foco.frp != null;
    return L.circleMarker([foco.lat, foco.lon], {
      radius: destacado ? 9 : 5,
      // Contorno na própria cor do foco (como era originalmente).
      color: frpColor(foco.frp),
      weight: 1,
      fillColor: frpColor(foco.frp),
      fillOpacity: 0.85,
    }).bindPopup(popupHtml(foco, destacado));
  });

  cluster.addLayers(markers);
}

onMounted(() => {
  if (!mapEl.value) return;

  map = L.map(mapEl.value, {
    zoomControl: true,
    attributionControl: false,
    minZoom: 4,
    // Sem camada de tiles, o maxZoom precisa vir direto do mapa:
    // o Leaflet usa este limite no fitBounds da camada de estados.
    maxZoom: 18,
    maxBounds: limitesBrasil,
    maxBoundsViscosity: 1,
  }).setView([-11.5, -53.5], 4);

  // Sem tiles externos: o "mapa" é o desenho vetorial do Brasil
  // (coroplético de estados) sobre o fundo da paleta do projeto.
  // Assim só o território brasileiro aparece.

  cluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 48,
  });
  cluster.addTo(map);
  renderMarkers(props.focos);

  // Painel abaixo dos marcadores para a camada de estados (coroplético).
  map.createPane("estados");
  map.getPane("estados")!.style.zIndex = "200";
  void carregarEstados();

  // Botão "Filtrar por este município" dentro do popup do foco.
  map.on("popupopen", (event) => {
    const botao = event.popup
      .getElement()
      ?.querySelector<HTMLButtonElement>(".popup-filtrar");
    if (!botao) return;
    botao.addEventListener("click", () => {
      emit("filtrar-municipio", {
        municipio: botao.dataset.municipio ?? "",
        estado: botao.dataset.estado ?? "",
      });
      map?.closePopup();
    });
  });
});

watch(
  () => props.focos,
  (focos) => {
    renderMarkers(focos);
    estilizarEstados();
  },
);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
  cluster = null;
});
</script>

<template>
  <div class="mapa-wrap">
    <div ref="mapEl" class="map" />
    <div class="legenda" role="note" aria-label="Legenda do mapa">
      <strong class="legenda__titulo">Legenda</strong>
      <div class="legenda__grupo">
        <span class="legenda__leg">Bolhas — focos agrupados</span>
        <div class="legenda__linha"><i class="sw sw--bolha-verde" /> poucos focos</div>
        <div class="legenda__linha"><i class="sw sw--bolha-amarela" /> quantidade média</div>
        <div class="legenda__linha"><i class="sw sw--bolha-laranja" /> muitos focos</div>
      </div>
      <div class="legenda__grupo">
        <span class="legenda__leg">Estados — focos no recorte</span>
        <div class="legenda__linha"><i class="sw sw--estado-claro" /> poucos focos</div>
        <div class="legenda__linha"><i class="sw sw--estado-medio" /> quantidade média</div>
        <div class="legenda__linha"><i class="sw sw--estado-escuro" /> muitos focos</div>
      </div>
      <div class="legenda__grupo">
        <span class="legenda__leg">Focos — intensidade (FRP)</span>
        <div class="legenda__linha"><i class="sw sw--foco-ambar" /> abaixo de 40 MW</div>
        <div class="legenda__linha"><i class="sw sw--foco-vermelho" /> 40 a 99 MW</div>
        <div class="legenda__linha"><i class="sw sw--foco-escuro" /> 100 MW ou mais</div>
      </div>
      <p class="legenda__nota">
        FRP = potência radiativa do fogo (MW): quanto maior, mais energia o
        fogo libera.
      </p>
    </div>
  </div>
</template>

<style scoped>
.mapa-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.map {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}

/* Botão de filtro dentro do popup (estilo global do Leaflet). */
:deep(.popup-filtrar) {
  display: block;
  margin-top: 0.5rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: transparent;
  color: #1c1408;
  font-size: 0.8rem;
  cursor: pointer;
  width: 100%;
}

:deep(.popup-filtrar:hover) {
  background: var(--accent);
}

/* Números das bolhas de cluster: tom escuro suave sobre bolhas claras. */
:deep(.marker-cluster span) {
  color: rgb(62, 70, 55);
  font-weight: 600;
}

/* Legenda no canto inferior direito, sobre o mapa. */
.legenda {
  position: absolute;
  right: 20px;
  bottom: 12px;
  z-index: 1000;
  max-width: 230px;
  padding: 0.6rem 0.75rem;
  background: color-mix(in srgb, var(--panel) 90%, transparent);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 14px rgb(0 0 0 / 45%);
  font-size: 0.72rem;
  line-height: 1.35;
}

.legenda__titulo {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.74rem;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.legenda__grupo {
  margin-bottom: 0.4rem;
}

.legenda__leg {
  display: block;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 0.15rem;
}

.legenda__linha {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.1rem 0;
}

.sw {
  display: inline-block;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgb(232 239 228 / 25%);
}

.sw--bolha-verde { background: rgb(181 226 140); }
.sw--bolha-amarela { background: rgb(241 211 87); }
.sw--bolha-laranja { background: rgb(253 156 115); }
.sw--estado-claro { background: rgb(252 165 165); }
.sw--estado-medio { background: rgb(219 96 96); }
.sw--estado-escuro { background: rgb(185 28 28); }
.sw--foco-ambar { background: #f59e0b; }
.sw--foco-vermelho { background: #ef4444; }
.sw--foco-escuro { background: #b91c1c; }

.legenda__nota {
  margin: 0.35rem 0 0;
  padding-top: 0.35rem;
  border-top: 1px solid var(--panel-border);
  color: var(--muted);
}
</style>
