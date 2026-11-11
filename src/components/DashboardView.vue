<script setup lang="ts">
import { computed, ref } from "vue";
import type { Foco } from "../types";
import { countBy, focosToCsv } from "../lib/queimadas";

const props = defineProps<{ focos: Foco[]; data: string }>();

const LIMITE_DETALHE = 100;
const limiteDetalhe = ref(LIMITE_DETALHE);

const pctFormato = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function pct(count: number): string {
  if (!props.focos.length) return "0%";
  return `${pctFormato.format((count / props.focos.length) * 100)}%`;
}

function media(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v != null);
  if (!validos.length) return null;
  return validos.reduce((a, b) => a + b, 0) / validos.length;
}

const frpTotal = computed(() =>
  props.focos.reduce((soma, f) => soma + (f.frp ?? 0), 0),
);

const resumo = computed(() => {
  const focos = props.focos;
  const estados = new Set(focos.map((f) => f.estado).filter(Boolean));
  const municipios = new Set(focos.map((f) => f.municipio).filter(Boolean));
  const riscoMedio = media(focos.map((f) => f.riscoFogo));
  const chuvaMedia = media(focos.map((f) => f.diasSemChuva));
  return [
    { rotulo: "Focos de calor", valor: focos.length.toLocaleString("pt-BR") },
    { rotulo: "Estados atingidos", valor: estados.size.toLocaleString("pt-BR") },
    {
      rotulo: "Municípios atingidos",
      valor: municipios.size.toLocaleString("pt-BR"),
    },
    {
      rotulo: "FRP total",
      valor: `${frpTotal.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MW`,
    },
    {
      rotulo: "Risco de fogo médio",
      valor: riscoMedio == null ? "—" : riscoMedio.toFixed(2),
    },
    {
      rotulo: "Dias sem chuva (média)",
      valor: chuvaMedia == null ? "—" : chuvaMedia.toFixed(1),
    },
  ];
});

function agregacao(valores: string[]): { label: string; count: number; pct: string }[] {
  return countBy(valores).map((item) => ({ ...item, pct: pct(item.count) }));
}

const porEstado = computed(() => agregacao(props.focos.map((f) => f.estado)));
const porBioma = computed(() => agregacao(props.focos.map((f) => f.bioma)));
const porSatelite = computed(() =>
  agregacao(props.focos.map((f) => f.satelite)),
);

const porMunicipio = computed(() => {
  const mapa = new Map<
    string,
    { municipio: string; estado: string; count: number; frpMax: number | null }
  >();
  for (const f of props.focos) {
    const chave = `${f.municipio}|${f.estado}`;
    const atual =
      mapa.get(chave) ?? {
        municipio: f.municipio || "—",
        estado: f.estado || "—",
        count: 0,
        frpMax: null,
      };
    atual.count += 1;
    if (f.frp != null && (atual.frpMax == null || f.frp > atual.frpMax)) {
      atual.frpMax = f.frp;
    }
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
});

const detalheFocos = computed(() =>
  props.focos.slice(0, limiteDetalhe.value),
);

const temMaisDetalhe = computed(
  () => props.focos.length > limiteDetalhe.value,
);

function exportarCsv() {
  const csv = focosToCsv(props.focos);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `focos_filtrados_${props.data.replaceAll("-", "")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard__cabecalho">
      <div>
        <h2>Dashboard de focos de calor</h2>
        <p>
          {{ focos.length.toLocaleString("pt-BR") }} focos no recorte
          atualizado
          <template v-if="data"> — {{ data.split("-").reverse().join("/") }}</template
          >.
        </p>
      </div>
      <button
        type="button"
        class="exportar"
        :disabled="!focos.length"
        @click="exportarCsv"
      >
        ⬇ Exportar CSV ({{ focos.length.toLocaleString("pt-BR") }})
      </button>
    </header>

    <p v-if="!focos.length" class="vazio">
      Nenhum foco para os filtros atuais. Ajuste a data, estado, bioma ou
      satélite no painel à esquerda.
    </p>

    <template v-else>
      <section class="cards" aria-label="Resumo">
        <article v-for="item in resumo" :key="item.rotulo" class="card">
          <strong>{{ item.valor }}</strong>
          <span>{{ item.rotulo }}</span>
        </article>
      </section>

      <div class="tabelas">
        <section class="bloco" aria-label="Focos por estado">
          <h3>Focos por estado</h3>
          <table>
            <thead>
              <tr><th>Estado</th><th>Focos</th><th>% do total</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in porEstado" :key="item.label">
                <td>{{ item.label }}</td>
                <td>{{ item.count.toLocaleString("pt-BR") }}</td>
                <td>{{ item.pct }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="bloco" aria-label="Focos por bioma">
          <h3>Focos por bioma</h3>
          <table>
            <thead>
              <tr><th>Bioma</th><th>Focos</th><th>% do total</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in porBioma" :key="item.label">
                <td>{{ item.label }}</td>
                <td>{{ item.count.toLocaleString("pt-BR") }}</td>
                <td>{{ item.pct }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="bloco" aria-label="Municípios com mais focos">
          <h3>Top 15 municípios</h3>
          <table>
            <thead>
              <tr>
                <th>Município</th><th>Estado</th><th>Focos</th><th>FRP máx. (MW)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in porMunicipio" :key="item.municipio + item.estado">
                <td>{{ item.municipio }}</td>
                <td>{{ item.estado }}</td>
                <td>{{ item.count.toLocaleString("pt-BR") }}</td>
                <td>
                  {{ item.frpMax == null ? "—" : item.frpMax.toFixed(1) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="bloco" aria-label="Focos por satélite">
          <h3>Focos por satélite</h3>
          <table>
            <thead>
              <tr><th>Satélite</th><th>Focos</th><th>% do total</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in porSatelite" :key="item.label">
                <td>{{ item.label }}</td>
                <td>{{ item.count.toLocaleString("pt-BR") }}</td>
                <td>{{ item.pct }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section class="bloco bloco--cheio" aria-label="Detalhe dos focos">
        <h3>Detalhe dos focos</h3>
        <div class="rolagem">
          <table>
            <thead>
              <tr>
                <th>Data/hora (GMT)</th>
                <th>Município</th>
                <th>Estado</th>
                <th>Bioma</th>
                <th>Satélite</th>
                <th>FRP (MW)</th>
                <th>Risco</th>
                <th>Dias s/ chuva</th>
                <th>Precip. (mm)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="foco in detalheFocos" :key="foco.id">
                <td>{{ foco.dataHoraGmt }}</td>
                <td>{{ foco.municipio || "—" }}</td>
                <td>{{ foco.estado || "—" }}</td>
                <td>{{ foco.bioma || "—" }}</td>
                <td>{{ foco.satelite || "—" }}</td>
                <td>{{ foco.frp == null ? "—" : foco.frp.toFixed(1) }}</td>
                <td>{{ foco.riscoFogo == null ? "—" : foco.riscoFogo.toFixed(2) }}</td>
                <td>{{ foco.diasSemChuva ?? "—" }}</td>
                <td>{{ foco.precipitacao == null ? "—" : foco.precipitacao.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="temMaisDetalhe" class="mais">
          Mostrando {{ detalheFocos.length.toLocaleString("pt-BR") }} de
          {{ focos.length.toLocaleString("pt-BR") }} focos.
          <button type="button" @click="limiteDetalhe += LIMITE_DETALHE">
            Carregar mais {{ LIMITE_DETALHE }}
          </button>
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  height: 100%;
  overflow: auto;
  padding: 1.25rem;
  background: var(--bg);
}

.dashboard__cabecalho {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

h2 {
  margin: 0 0 0.25rem;
  font-size: 1.2rem;
}

.dashboard__cabecalho p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.exportar {
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: transparent;
  color: var(--accent);
  font-size: 0.85rem;
  cursor: pointer;
}

.exportar:hover:not(:disabled) {
  background: var(--accent);
  color: #1c1408;
}

.exportar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vazio {
  color: var(--muted);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.65rem;
  margin-bottom: 1.25rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.8rem 0.9rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
}

.card strong {
  font-size: 1.25rem;
}

.card span {
  color: var(--muted);
  font-size: 0.78rem;
}

.tabelas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.bloco {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 0.9rem 1rem;
  min-width: 0;
}

.bloco--cheio {
  margin-bottom: 1.5rem;
}

h3 {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rolagem {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.86rem;
}

th,
td {
  padding: 0.4rem 0.55rem;
  border-bottom: 1px solid var(--panel-border);
  text-align: left;
  white-space: nowrap;
}

th {
  color: var(--muted);
  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

tbody tr:hover {
  background: rgb(245 158 11 / 8%);
}

.mais {
  margin: 0.6rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.mais button {
  margin-left: 0.4rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.mais button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
