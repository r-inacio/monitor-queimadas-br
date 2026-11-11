<script setup lang="ts">
import type { Filtros } from "../types";

const props = defineProps<{
  data: string;
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
}>();

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
      Data
      <input
        type="date"
        :value="data"
        @input="
          emit(
            'update:data',
            ($event.target as HTMLInputElement).value,
          )
        "
      />
    </label>

    <label>
      Estado
      <select
        :value="filtros.estado"
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

    <p v-if="carregando" class="status">Carregando CSV do INPE…</p>
    <p v-else-if="erro" class="status error">{{ erro }}</p>
    <p v-else class="status">
      {{ filtrados.toLocaleString("pt-BR") }} focos filtrados de
      {{ total.toLocaleString("pt-BR") }} no dia.
    </p>

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
