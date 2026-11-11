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

// Limites do território brasileiro: a navegação (arrastar/zoom) fica
// presa dentro desta caixa.
const limitesBrasil = L.latLngBounds([-34.2, -75.2], [6.0, -32.8]);

function frpColor(frp: number | null): string {
  if (frp == null) return "#f59e0b";
  if (frp >= 100) return "#b91c1c";
  if (frp >= 40) return "#ef4444";
  return "#f59e0b";
}

function popupHtml(foco: Foco): string {
  const risco =
    foco.riscoFogo == null ? "—" : foco.riscoFogo.toFixed(2);
  const frp = foco.frp == null ? "—" : `${foco.frp.toFixed(1)} MW`;
  const chuva =
    foco.diasSemChuva == null ? "—" : String(foco.diasSemChuva);
  const precip =
    foco.precipitacao == null ? "—" : `${foco.precipitacao.toFixed(1)} mm`;

  return `
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

  const markers = focos.map((foco) =>
    L.circleMarker([foco.lat, foco.lon], {
      radius: 5,
      color: frpColor(foco.frp),
      weight: 1,
      fillOpacity: 0.85,
    }).bindPopup(popupHtml(foco)),
  );

  cluster.addLayers(markers);
}

onMounted(() => {
  if (!mapEl.value) return;

  map = L.map(mapEl.value, {
    zoomControl: true,
    minZoom: 4,
    maxBounds: limitesBrasil,
    maxBoundsViscosity: 1,
  }).setView([-11.5, -53.5], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · dados INPE/Queimadas',
    maxZoom: 18,
  }).addTo(map);

  cluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 48,
  });
  cluster.addTo(map);
  renderMarkers(props.focos);

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
  (focos) => renderMarkers(focos),
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
  background: #0b100b;
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

/* Legenda no canto inferior direito, sobre o mapa. */
.legenda {
  position: absolute;
  right: 12px;
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
  width: 11px;
  height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgb(0 0 0 / 30%);
}

.sw--bolha-verde { background: rgb(181 226 140); }
.sw--bolha-amarela { background: rgb(241 211 87); }
.sw--bolha-laranja { background: rgb(253 156 115); }
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
