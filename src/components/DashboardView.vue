<script setup lang="ts">
import { computed, ref } from "vue";
import type { Foco } from "../types";
import { countBy, focosToCsv } from "../lib/queimadas";

const props = defineProps<{ focos: Foco[]; data: string }>();

const LIMITE_DETALHE = 100;
const limiteDetalhe = ref(LIMITE_DETALHE);

// Sigla da UF para a tabela de municípios (estado vem por extenso no CSV).
const ufPorEstado: Record<string, string> = {
  ACRE: "AC",
  ALAGOAS: "AL",
  AMAPÁ: "AP",
  AMAZONAS: "AM",
  BAHIA: "BA",
  CEARÁ: "CE",
  "DISTRITO FEDERAL": "DF",
  "ESPÍRITO SANTO": "ES",
  GOIÁS: "GO",
  MARANHÃO: "MA",
  "MATO GROSSO": "MT",
  "MATO GROSSO DO SUL": "MS",
  "MINAS GERAIS": "MG",
  PARÁ: "PA",
  PARAÍBA: "PB",
  PARANÁ: "PR",
  PERNAMBUCO: "PE",
  PIAUÍ: "PI",
  "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN",
  "RIO GRANDE DO SUL": "RS",
  RONDÔNIA: "RO",
  RORAIMA: "RR",
  "SANTA CATARINA": "SC",
  "SÃO PAULO": "SP",
  SERGIPE: "SE",
  TOCANTINS: "TO",
};

function ufDe(estado: string): string {
  return ufPorEstado[estado.toUpperCase()] ?? estado.slice(0, 2);
}

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
    { municipio: string; estado: string; count: number }
  >();
  for (const f of props.focos) {
    const chave = `${f.municipio}|${f.estado}`;
    const atual =
      mapa.get(chave) ?? {
        municipio: f.municipio || "—",
        estado: f.estado || "—",
        count: 0,
      };
    atual.count += 1;
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
      <h2>
        Dashboard de focos de calor
        <span class="recorte">
          · {{ focos.length.toLocaleString("pt-BR") }} focos no recorte
          atualizado<template v-if="data">
            — {{ data.split("-").reverse().join("/") }}</template
          >
        </span>
      </h2>
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
        <section class="bloco bloco--estado" aria-label="Focos por estado">
          <h3>Focos por estado</h3>
          <div class="rolagem">
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
          </div>
        </section>

        <section class="bloco bloco--top15" aria-label="Municípios com mais focos">
          <h3>Top 15 municípios</h3>
          <div class="rolagem">
            <table>
              <thead>
                <tr><th>Município</th><th>UF</th><th>Focos</th></tr>
              </thead>
              <tbody>
                <tr v-for="item in porMunicipio" :key="item.municipio + item.estado">
                  <td>{{ item.municipio }}</td>
                  <td>{{ ufDe(item.estado) }}</td>
                  <td>{{ item.count.toLocaleString("pt-BR") }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="bloco bloco--ajustado" aria-label="Focos por bioma">
          <h3>Focos por bioma</h3>
          <div class="rolagem">
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
          </div>
        </section>

        <section class="bloco bloco--ajustado" aria-label="Focos por satélite">
          <h3>Focos por satélite</h3>
          <div class="rolagem">
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
          </div>
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  /* A linha do botão Mapa|Dashboard é o limite: nada passa dela. */
  padding-bottom: 58px;
  background: var(--bg);
}

.dashboard__cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  flex: none;
}

h2 {
  margin: 0;
  font-size: 1.2rem;
}

.recorte {
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 400;
}

.exportar {
  flex: none;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--accent);
  border-radius: 7px;
  background: transparent;
  color: var(--accent);
  font-size: 0.78rem;
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
  flex: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.65rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.55rem 0.7rem;
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
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
}

/* Estado estreito à esquerda; Top 15 aproveita o restante da linha. */
.bloco--estado {
  flex: 0 1 320px;
  min-width: 280px;
}

.bloco--top15 {
  flex: 1 1 420px;
  min-width: 0;
}

/* Bioma e Satélite encolhem para o tamanho dos próprios dados. */
.bloco--ajustado {
  flex: 0 1 auto;
  width: fit-content;
  max-width: 100%;
}

.bloco {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
  min-width: 0;
}

/* Detalhe dos focos ocupa o espaço restante e rola internamente. */
.bloco--cheio {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bloco--cheio .rolagem {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
}

h3 {
  margin: 0 0 0.6rem;
  font-size: 0.9rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rolagem {
  /* Altura limitada por seção: tabelas longas rolam internamente,
     sem esticar a página inteira por cima do botão Mapa|Dashboard. */
  overflow: auto;
  max-height: 170px;
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

/* Telas pequenas ou baixas: a rolagem volta para nada ficar cortado. */
@media (max-width: 860px), (max-height: 720px) {
  .dashboard {
    overflow-y: auto;
  }

  .bloco--cheio .rolagem {
    max-height: 260px;
  }
}
</style>
