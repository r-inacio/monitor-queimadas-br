<script setup lang="ts">
import { computed } from "vue";
import type { Filtros } from "../types";

const props = defineProps<{
  data: string;
  dataMinima?: string;
  dataMaxima?: string;
  filtros: Filtros;
  estados: string[];
  biomas: string[];
  satelites: string[];
  total: number;
  filtrados: number;
  topEstados: { label: string; count: number }[];
  topBiomas: { label: string; count: number }[];
  topMunicipios: { label: string; count: number }[];
  carregando: boolean;
  erro: string | null;
}>();

const emit = defineEmits<{
  "update:data": [value: string];
  "update:filtros": [value: Filtros];
  atualizar: [];
}>();

// Dias disponíveis na janela recente, mais recente primeiro,
// apresentados como lista fechada (data por extenso) — sem calendário.
const formatadorLongo = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dataDe(chave: string): Date {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function chaveDe(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

const diasDisponiveis = computed(() => {
  const fim = props.dataMaxima ? dataDe(props.dataMaxima) : dataDe(props.data);
  const inicio = props.dataMinima
    ? dataDe(props.dataMinima)
    : new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - 29);
  const dias: { valor: string; rotulo: string; recente: boolean }[] = [];
  for (let d = new Date(fim); d >= inicio; d.setDate(d.getDate() - 1)) {
    const valor = chaveDe(d);
    dias.push({
      valor,
      rotulo: formatadorLongo.format(d),
      recente: valor === chaveDe(new Date()),
    });
  }
  return dias;
});

function patchFiltro(key: keyof Filtros, value: string, current: Filtros) {
  emit("update:filtros", { ...current, [key]: value });
}

// Trocar o estado limpa a cidade: a lista pertence ao estado escolhido.
function patchEstado(value: string, current: Filtros) {
  emit("update:filtros", { ...current, estado: value, municipio: "" });
}

// Clicar na cidade aplica o filtro; clicar de novo limpa.
function escolherCidade(label: string) {
  const proximo =
    props.filtros.municipio === label ? "" : label;
  emit("update:filtros", { ...props.filtros, municipio: proximo });
}
</script>

<template>
  <aside class="panel">
    <header>
      <p class="kicker">Programa Queimadas · INPE</p>
      <h1>Focos de calor</h1>
      <p class="lead">
        Front dos dados abertos diários de focos no Brasil.
      </p>
    </header>

    <label>
      Dia dos focos
      <select
        :value="data"
        title="Dias recentes com dados do INPE (últimos 30). Séries antigas estão no Histórico do dashboard. Filtros escolhidos são mantidos ao trocar o dia."
        @change="
          emit('update:data', ($event.target as HTMLSelectElement).value)
        "
      >
        <option v-for="dia in diasDisponiveis" :key="dia.valor" :value="dia.valor">
          {{ dia.rotulo }}{{ dia.recente ? " (hoje)" : "" }}
        </option>
      </select>
    </label>

    <label>
      Estado
      <select
        :value="filtros.estado"
        title="Estado federativo onde os focos foram detectados. Trocar o estado redefine a cidade escolhida."
        @change="
          patchEstado(
            ($event.target as HTMLSelectElement).value,
            filtros,
          )
        "
      >
        <option value="">Todos</option>
        <option v-for="estado in estados" :key="estado" :value="estado">
          {{ estado }}
        </option>
      </select>
    </label>

    <section class="cidades">
      <h2>Cidades{{ filtros.estado ? ` — ${filtros.estado}` : "" }}</h2>
      <p v-if="!filtros.estado" class="cidades__dica">
        Escolha um estado para ver as cidades com focos.
      </p>
      <ul v-else class="cidades__lista">
        <li v-for="item in topMunicipios" :key="item.label">
          <button
            type="button"
            class="cidades__item"
            :class="{ ativo: filtros.municipio === item.label }"
            :title="`Clique para filtrar os focos de ${item.label}`"
            @click="escolherCidade(item.label)"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.count.toLocaleString("pt-BR") }}</strong>
          </button>
        </li>
      </ul>
    </section>

    <label>
      Bioma
      <select
        :value="filtros.bioma"
        title="Bioma brasileiro onde o foco foi detectado (Amazônia, Cerrado, Caatinga…)."
        @change="
          patchFiltro(
            'bioma',
            ($event.target as HTMLSelectElement).value,
            filtros,
          )
        "
      >
        <option value="">Todos</option>
        <option v-for="bioma in biomas" :key="bioma" :value="bioma">
          {{ bioma }}
        </option>
      </select>
    </label>

    <label>
      Satélite
      <select
        :value="filtros.satelite"
        title="Satélite do INPE que detectou o foco (GOES-19, AQUA, NOAA-20…)."
        @change="
          patchFiltro(
            'satelite',
            ($event.target as HTMLSelectElement).value,
            filtros,
          )
        "
      >
        <option value="">Todos</option>
        <option v-for="satelite in satelites" :key="satelite" :value="satelite">
          {{ satelite }}
        </option>
      </select>
    </label>

    <div class="status-linha">
      <p v-if="carregando" class="status">Carregando CSV do INPE…</p>
      <p v-else-if="erro" class="status error">{{ erro }}</p>
      <p v-else class="status">
        {{ filtrados.toLocaleString("pt-BR") }} focos filtrados de
        {{ total.toLocaleString("pt-BR") }} no dia.
      </p>
      <button
        type="button"
        class="atualizar"
        :disabled="carregando"
        title="Buscar novamente os dados do dia no INPE (útil quando o dia ainda está sendo atualizado pelo INPE)."
        @click="emit('atualizar')"
      >
        ↻ Atualizar
      </button>
    </div>

    <section v-if="topEstados.length">
      <h2>Estados</h2>
      <ul>
        <li v-for="item in topEstados.slice(0, 6)" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.count.toLocaleString("pt-BR") }}</strong>
        </li>
      </ul>
    </section>

    <section v-if="topBiomas.length">
      <h2>Biomas</h2>
      <ul>
        <li v-for="item in topBiomas.slice(0, 6)" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.count.toLocaleString("pt-BR") }}</strong>
        </li>
      </ul>
    </section>

    <footer>
      <p>Fontes públicas:</p>
      <a href="https://terrabrasilis.dpi.inpe.br/queimadas/portal/" target="_blank" rel="noreferrer">Portal Queimadas</a>
      <a href="https://data.inpe.br/queimadas/dados-abertos/" target="_blank" rel="noreferrer">Dados abertos</a>
      <a href="https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/" target="_blank" rel="noreferrer">CSV diário</a>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  width: min(360px, 100%);
  height: 100%;
  overflow: auto;
  padding: 1.25rem;
  background: var(--panel);
  border-right: 1px solid var(--panel-border);
}

.kicker {
  margin: 0 0 0.35rem;
  color: var(--accent);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0 0 0.5rem;
}

h1 {
  font-size: 1.45rem;
}

h2 {
  font-size: 0.9rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.lead,
.status,
footer p {
  color: var(--muted);
  font-size: 0.92rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0.85rem 0;
  font-size: 0.85rem;
  color: var(--muted);
}

input,
select {
  background: #10150f;
  color: var(--text);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
}

.status.error {
  color: var(--danger);
}

.status-linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.status-linha .status {
  min-width: 0;
}

.atualizar {
  flex: none;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: transparent;
  color: var(--text);
  font-size: 0.78rem;
  cursor: pointer;
}

.atualizar:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.atualizar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Lista de cidades: rolagem interna para não esticar o painel. */
.cidades {
  margin: 0.85rem 0;
}

.cidades h2 {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cidades__dica {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.cidades__lista {
  max-height: 220px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: #10150f;
}

.cidades__item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-bottom: 1px solid var(--panel-border);
  background: transparent;
  color: var(--text);
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}

.cidades__item:last-child {
  border-bottom: 0;
}

.cidades__item:hover {
  background: rgb(245 158 11 / 10%);
}

.cidades__item.ativo {
  background: var(--accent);
  color: #1c1408;
  font-weight: 600;
}

ul {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
}

li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--panel-border);
  font-size: 0.9rem;
}

footer {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 1.5rem;
  font-size: 0.88rem;
}
</style>
