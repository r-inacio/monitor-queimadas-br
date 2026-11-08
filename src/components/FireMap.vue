<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Foco } from "../types";

const props = defineProps<{ focos: Foco[] }>();

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let cluster: L.MarkerClusterGroup | null = null;

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
  }).setView([-14.2, -51.9], 4);

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
  <div ref="mapEl" class="map" />
</template>

<style scoped>
.map {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #0b100b;
}
</style>
