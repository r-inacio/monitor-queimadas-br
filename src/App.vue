<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import DashboardView from "./components/DashboardView.vue";
import FiltersPanel from "./components/FiltersPanel.vue";
import FireMap from "./components/FireMap.vue";
import ViewToggle from "./components/ViewToggle.vue";
import type { Filtros, Foco, Visao } from "./types";
import {
  countBy,
  fetchFocosDiarios,
  fromInputDate,
  toInputDate,
  uniqueSorted,
} from "./lib/queimadas";

const hoje = new Date();

// Janela de datas recentes: os CSVs diários são confiáveis nos dias
// mais recentes — a busca de datas antigas fica para o histórico.
function deslocarDias(base: Date, dias: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return toInputDate(d);
}
const JANELA_DIAS = 30;
const dataMinima = deslocarDias(hoje, -JANELA_DIAS);
const dataMaxima = toInputDate(hoje);

function dataNaJanela(valor: string | null): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  if (valor < dataMinima) return dataMinima;
  if (valor > dataMaxima) return dataMaxima;
  return valor;
}

// Deep linking: filtros, data e visão ficam na URL, então uma tela
// filtrada pode ser compartilhada por link (ex.: ?data=2026-11-11&estado=PARÁ).
const url = new URLSearchParams(window.location.search);
const data = ref(
  dataNaJanela(url.get("data")) ?? toInputDate(hoje),
);
const filtros = ref<Filtros>({
  estado: url.get("estado") ?? "",
  municipio: url.get("municipio") ?? "",
  bioma: url.get("bioma") ?? "",
  satelite: url.get("satelite") ?? "",
});
const visao = ref<Visao>(url.get("visao") === "dashboard" ? "dashboard" : "mapa");
const focos = ref<Foco[]>([]);
const carregando = ref(false);
const erro = ref<string | null>(null);

// Focos sem o filtro de município: base do ranking de cidades,
// para que a lista mostre todas as cidades mesmo com uma selecionada.
const focosSemCidade = computed(() =>
  focos.value.filter((foco) => {
    if (filtros.value.estado && foco.estado !== filtros.value.estado) return false;
    if (filtros.value.bioma && foco.bioma !== filtros.value.bioma) return false;
    if (filtros.value.satelite && foco.satelite !== filtros.value.satelite)
      return false;
    return true;
  }),
);

const focosFiltrados = computed(() =>
  focosSemCidade.value.filter((foco) => {
    if (
      filtros.value.municipio &&
      foco.municipio !== filtros.value.municipio
    )
      return false;
    return true;
  }),
);

const estados = computed(() => uniqueSorted(focos.value.map((f) => f.estado)));
const biomas = computed(() => uniqueSorted(focos.value.map((f) => f.bioma)));
const satelites = computed(() =>
  uniqueSorted(focos.value.map((f) => f.satelite)),
);
const topEstados = computed(() =>
  countBy(focosSemCidade.value.map((f) => f.estado)),
);
const topBiomas = computed(() =>
  countBy(focosSemCidade.value.map((f) => f.bioma)),
);
const topMunicipios = computed(() =>
  countBy(focosSemCidade.value.map((f) => f.municipio)),
);

// Filtro pelo mapa (botão no popup do foco): restringe àquele município.
function filtrarPorMunicipio(alvo: { municipio: string; estado: string }) {
  filtros.value = {
    ...filtros.value,
    estado: alvo.estado,
    municipio: alvo.municipio,
  };
}

async function carregar() {
  carregando.value = true;
  erro.value = null;
  try {
    focos.value = await fetchFocosDiarios(fromInputDate(data.value));
    // Os filtros escolhidos no painel esquerdo são preservados ao trocar
    // a data: a recarga respeita Estado/Bioma/Satélite já selecionados.
  } catch (cause) {
    focos.value = [];
    erro.value =
      cause instanceof Error
        ? cause.message
        : "Falha ao buscar os dados de queimadas.";
  } finally {
    carregando.value = false;
  }
}

watch(data, carregar);
onMounted(carregar);

// Reflete o estado na URL (replaceState: sem poluir o histórico de navegação).
watch(
  () => JSON.stringify([data.value, filtros.value, visao.value]),
  () => {
    const params = new URLSearchParams();
    params.set("data", data.value);
    if (filtros.value.estado) params.set("estado", filtros.value.estado);
    if (filtros.value.municipio) params.set("municipio", filtros.value.municipio);
    if (filtros.value.bioma) params.set("bioma", filtros.value.bioma);
    if (filtros.value.satelite) params.set("satelite", filtros.value.satelite);
    if (visao.value !== "mapa") params.set("visao", visao.value);
    const consulta = params.toString();
    window.history.replaceState(
      null,
      "",
      consulta ? `?${consulta}` : window.location.pathname,
    );
  },
);
</script>

<template>
  <div class="layout">
    <FiltersPanel
      :data="data"
      :data-minima="dataMinima"
      :data-maxima="dataMaxima"
      :filtros="filtros"
      :estados="estados"
      :biomas="biomas"
      :satelites="satelites"
      :total="focos.length"
      :filtrados="focosFiltrados.length"
      :top-estados="topEstados"
      :top-biomas="topBiomas"
      :top-municipios="topMunicipios"
      :carregando="carregando"
      :erro="erro"
      @update:data="data = $event"
      @update:filtros="filtros = $event"
      @atualizar="carregar"
    />
    <main class="stage">
      <FireMap
        v-if="visao === 'mapa'"
        :focos="focosFiltrados"
        @filtrar-municipio="filtrarPorMunicipio"
      />
      <DashboardView
        v-else
        :focos="focosFiltrados"
        :data="data"
        :filtros="filtros"
      />
      <ViewToggle v-model="visao" />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  height: 100%;
}

main {
  min-width: 0;
  min-height: 0;
  position: relative;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  main {
    min-height: 55vh;
  }
}
</style>
