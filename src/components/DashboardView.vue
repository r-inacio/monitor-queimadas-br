<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GraficoBarras from "./GraficoBarras.vue";
import GraficoHistorico from "./GraficoHistorico.vue";
import type {
  AbaDashboard,
  Filtros,
  Foco,
  RegistroHistorico,
} from "../types";
import { countBy, focosToCsv } from "../lib/queimadas";

const props = defineProps<{
  focos: Foco[];
  data: string;
  filtros?: Filtros;
}>();

const LIMITE_DETALHE = 100;
const limiteDetalhe = ref(LIMITE_DETALHE);

// Abas internas do dashboard: Hoje | Gráficos | Histórico —
// cada aba cabe em uma página, sem rolagem.
const aba = ref<AbaDashboard>("hoje");
const abas: { valor: AbaDashboard; rotulo: string }[] = [
  { valor: "hoje", rotulo: "Hoje" },
  { valor: "graficos", rotulo: "Gráficos" },
  { valor: "historico", rotulo: "Histórico" },
];

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

// Último foco registrado no recorte (maior data/hora GMT do dia).
const escala = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

const ultimoFoco = computed(() => {
  let maisRecente: Foco | null = null;
  for (const f of props.focos) {
    if (!maisRecente || f.dataHoraGmt > maisRecente.dataHoraGmt) {
      maisRecente = f;
    }
  }
  return maisRecente;
});

// Quais blocos fazem sentido na aba Gráficos conforme o recorte:
// com cidade → só intensidade; com estado → bioma + intensidade;
// sem recorte → estado, bioma e intensidade.
const blocosGraficos = computed(() => {
  if (props.filtros?.municipio) return ["intensidade"];
  if (props.filtros?.estado) return ["bioma", "intensidade"];
  return ["estado", "bioma", "intensidade"];
});

// Distribuição por intensidade: contagem por faixa de FRP.
const intensidade = computed(() => {
  const faixas = [
    { rotulo: "Menos de 40 MW", total: 0 },
    { rotulo: "40 a 99 MW", total: 0 },
    { rotulo: "100 MW ou mais", total: 0 },
    { rotulo: "Sem FRP informado", total: 0 },
  ];
  for (const f of props.focos) {
    if (f.frp == null) faixas[3].total += 1;
    else if (f.frp < 40) faixas[0].total += 1;
    else if (f.frp < 100) faixas[1].total += 1;
    else faixas[2].total += 1;
  }
  return faixas;
});

// Série histórica conforme o recorte: cidade → município, estado →
// estado, sem recorte → total nacional. Os agregados têm quebra por
// estado e município (gerados a partir dos arquivos oficiais do INPE).
const ABREVIACOES_MES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function rotuloHistorico(r: RegistroHistorico): string {
  if (modoHistorico.value === "ano") return String(r.ano);
  const chave = r.mes ?? "";
  const indiceMes = Number(chave.slice(5, 7)) - 1;
  const mes = ABREVIACOES_MES[indiceMes] ?? chave.slice(5, 7);
  // Mês abreviado antes do ano: jan/2023.
  return `${mes}/${chave.slice(0, 4)}`;
}

const rotulosHistorico = computed(() =>
  registrosHistorico.value.map(rotuloHistorico),
);

const valoresHistorico = computed(() =>
  registrosHistorico.value.map((r) => {
    if (props.filtros?.municipio) {
      // [contagem, frpMedio, frpMax] → contagem é o índice 0.
      return (
        r.municipios?.[props.filtros.estado]?.[
          props.filtros.municipio
        ]?.[0] ?? 0
      );
    }
    if (props.filtros?.estado) {
      return r.estados?.[props.filtros.estado] ?? 0;
    }
    return r.total;
  }),
);

const tituloHistorico = computed(() => {
  const sufixo = props.filtros?.municipio
    ? `em ${props.filtros.municipio} (${props.filtros.estado})`
    : props.filtros?.estado
      ? `em ${props.filtros.estado}`
      : "no Brasil";
  return `Evolução ${modoHistorico.value === "ano" ? "anual" : "mensal"} de focos ${sufixo}`;
});

// Série de FRP médio por período para o recorte (cidade ou estado).
// Sem recorte não há agregado nacional de FRP — a série fica oculta.
const valoresFrpHistorico = computed(() => {
  if (props.filtros?.municipio) {
    return registrosHistorico.value.map(
      (r) => r.municipios?.[props.filtros!.estado]?.[props.filtros!.municipio]?.[1] ?? null,
    );
  }
  if (props.filtros?.estado) {
    return registrosHistorico.value.map(
      (r) => r.frp_estados?.[props.filtros!.estado]?.[1] ?? null,
    );
  }
  return null;
});

const temFrpHistorico = computed(
  () => !!valoresFrpHistorico.value && valoresFrpHistorico.value.some((v) => v != null),
);

const tituloFrpHistorico = computed(() =>
  props.filtros?.municipio
    ? `FRP médio do fogo em ${props.filtros.municipio} (MW)`
    : `FRP médio do fogo em ${props.filtros?.estado} (MW)`,
);

// Participação da cidade no total do estado (%) por período.
const valoresParticipacao = computed(() => {
  if (!props.filtros?.municipio) return null;
  return registrosHistorico.value.map((r) => {
    const cidade = r.municipios?.[props.filtros!.estado]?.[
      props.filtros!.municipio
    ]?.[0];
    const estado = r.estados?.[props.filtros!.estado] ?? 0;
    if (!cidade || !estado) return 0;
    return Math.round((cidade / estado) * 1000) / 10;
  });
});

const temParticipacao = computed(
  () => !!valoresParticipacao.value && valoresParticipacao.value.some((v) => v > 0),
);

const tituloParticipacao = computed(
  () =>
    `Participação de ${props.filtros?.municipio} nos focos de ${props.filtros?.estado} (%)`,
);

// Descrição do recorte ativo (estado e/ou cidade) para o contexto nas abas.
const recorteAtivo = computed(() => {
  const partes: string[] = [];
  if (props.filtros?.estado) partes.push(props.filtros.estado);
  if (props.filtros?.municipio) partes.push(props.filtros.municipio);
  if (props.filtros?.bioma) partes.push(`bioma ${props.filtros.bioma}`);
  if (props.filtros?.satelite) partes.push(`satélite ${props.filtros.satelite}`);
  return partes.length
    ? `Recorte: ${partes.join(" · ")} — ${props.focos.length.toLocaleString("pt-BR")} focos`
    : "";
});

// Histórico nacional (1998–2025 anual; 2023–2026 mensal), agregado dos
// dados oficiais do INPE — carregado sob demanda ao abrir a aba.
// Anual e mensal são carregados separadamente: o que existir é exibido,
// e o que faltar é avisado honestamente.
const modoHistorico = ref<"ano" | "mes">("ano");
const historicoAnual = ref<RegistroHistorico[]>([]);
const historicoMensal = ref<RegistroHistorico[]>([]);
const carregandoHistorico = ref(false);
const falhaAnual = ref(false);
const falhaMensal = ref(false);
const historicoCarregado = ref(false);

const registrosHistorico = computed(() =>
  modoHistorico.value === "ano"
    ? historicoAnual.value
    : historicoMensal.value,
);

const semDadosHistorico = computed(
  () => !historicoAnual.value.length && !historicoMensal.value.length,
);

async function carregarFonteHistorica(
  caminho: string,
): Promise<RegistroHistorico[]> {
  // no-cache: revalida o cache HTTP — os agregados podem ser
  // regenerados a qualquer momento pelo script.
  const resposta = await fetch(caminho, { cache: "no-cache" });
  if (!resposta.ok) {
    throw new Error(`${caminho} (${resposta.status})`);
  }
  return ((await resposta.json()) as { registros: RegistroHistorico[] })
    .registros;
}

watch(
  [aba, historicoCarregado],
  async ([abaAtual]) => {
    if (abaAtual !== "historico" || historicoCarregado.value) return;
    carregandoHistorico.value = true;
    falhaAnual.value = false;
    falhaMensal.value = false;
    const resultados = await Promise.allSettled([
      carregarFonteHistorica("/dados/historico-anual.json"),
      carregarFonteHistorica("/dados/historico-mensal.json"),
    ]);
    if (resultados[0].status === "fulfilled") {
      historicoAnual.value = resultados[0].value;
    } else {
      falhaAnual.value = true;
    }
    if (resultados[1].status === "fulfilled") {
      historicoMensal.value = resultados[1].value;
    } else {
      falhaMensal.value = true;
    }
    carregandoHistorico.value = false;
    historicoCarregado.value = true;
  },
);
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

    <nav class="abas" aria-label="Seções do dashboard">
      <button
        v-for="item in abas"
        :key="item.valor"
        type="button"
        class="abas__botao"
        :class="{ ativo: aba === item.valor }"
        :aria-pressed="aba === item.valor"
        @click="aba = item.valor"
      >
        {{ item.rotulo }}
      </button>
    </nav>

    <!-- ABA HOJE -->
    <template v-if="aba === 'hoje'">
      <p v-if="!focos.length" class="vazio">
        Nenhum foco para os filtros atuais. Ajuste a data, estado, bioma ou
        satélite no painel à esquerda.
      </p>

      <template v-else>
        <p class="ultimo-foco" aria-label="Último foco registrado no recorte">
          <strong>Último foco registrado:</strong>
          {{ ultimoFoco?.municipio || "—" }}/{{
            ufDe(ultimoFoco?.estado ?? "")
          }}
          · {{ ultimoFoco?.dataHoraGmt?.slice(11) ?? "—" }} GMT
          · {{ ultimoFoco?.satelite || "—" }}
          · lat {{ escala.format(ultimoFoco?.lat ?? 0) }}, lon
          {{ escala.format(ultimoFoco?.lon ?? 0) }}
        </p>

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
    </template>

    <!-- ABA GRÁFICOS -->
    <template v-else-if="aba === 'graficos'">
      <p v-if="!focos.length" class="vazio">
        Nenhum foco para os filtros atuais — ajuste os filtros para ver os
        gráficos.
      </p>
      <template v-else>
        <p v-if="recorteAtivo" class="ultimo-foco">{{ recorteAtivo }}</p>
        <div class="grade-graficos">
          <section
            v-if="blocosGraficos.includes('estado')"
            class="bloco bloco--grafico"
            aria-label="Barras por estado"
          >
            <h3>Incidência por estado</h3>
            <GraficoBarras
              :rotulos="porEstado.slice(0, 10).map((i) => i.label)"
              :valores="porEstado.slice(0, 10).map((i) => i.count)"
              horizontal
              altura="100%"
            />
          </section>

          <section
            v-if="blocosGraficos.includes('bioma')"
            class="bloco bloco--grafico"
            aria-label="Barras por bioma"
          >
            <h3>Incidência por bioma</h3>
            <GraficoBarras
              :rotulos="porBioma.map((i) => i.label)"
              :valores="porBioma.map((i) => i.count)"
              altura="100%"
            />
          </section>

          <section
            class="bloco bloco--grafico bloco--largo"
            aria-label="Distribuição por intensidade"
          >
            <h3>Distribuição por intensidade (FRP)</h3>
            <GraficoBarras
              :rotulos="intensidade.map((i) => i.rotulo)"
              :valores="intensidade.map((i) => i.total)"
              cor="#ef4444"
              altura="100%"
            />
          </section>
        </div>
      </template>
    </template>

    <!-- ABA HISTÓRICO -->
    <template v-else>
      <div class="historico">
        <div class="historico__barra">
          <div class="abas abas--compactas" role="group" aria-label="Fonte do histórico">
            <button
              type="button"
              class="abas__botao"
              :class="{ ativo: modoHistorico === 'ano' }"
              @click="modoHistorico = 'ano'"
            >
              Anual (1998–2025)
            </button>
            <button
              type="button"
              class="abas__botao"
              :class="{ ativo: modoHistorico === 'mes' }"
              @click="modoHistorico = 'mes'"
            >
              Mensal (2023–2026)
            </button>
          </div>
          <span class="historico__fonte">
            Histórico nacional agregado dos dados oficiais do INPE —
            independe dos filtros do dia.
          </span>
        </div>

        <p v-if="carregandoHistorico" class="status-hist">Carregando histórico…</p>

        <template v-else>
          <p v-if="semDadosHistorico" class="status-hist">
            Não há dados históricos disponíveis no momento. Verifique a
            existência dos arquivos agregados do INPE
            (<code>/dados/historico-anual.json</code> e
            <code>/dados/historico-mensal.json</code>) e gere-os novamente com
            <code>scripts/gerar-historico.py</code>.
          </p>
          <template v-else>
            <p v-if="modoHistorico === 'ano' && falhaAnual" class="status-hist status-hist--erro">
              Os dados do histórico anual estão indisponíveis no momento.
            </p>
            <p v-if="modoHistorico === 'mes' && falhaMensal" class="status-hist status-hist--erro">
              Os dados do histórico mensal estão indisponíveis no momento.
            </p>
            <section
              v-if="(modoHistorico === 'ano' && !falhaAnual) || (modoHistorico === 'mes' && !falhaMensal)"
              class="bloco bloco--historico"
            >
              <h3>{{ tituloHistorico }}</h3>
              <GraficoHistorico
                :rotulos="rotulosHistorico"
                :valores="valoresHistorico"
              />
            </section>

            <div
              v-if="temFrpHistorico || temParticipacao"
              class="historico__extras"
            >
              <section
                v-if="temFrpHistorico"
                class="bloco"
                aria-label="FRP médio no histórico"
              >
                <h3>{{ tituloFrpHistorico }}</h3>
                <GraficoBarras
                  :rotulos="rotulosHistorico"
                  :valores="valoresFrpHistorico!.map((v) => v ?? 0)"
                  tipo="line"
                  altura="150px"
                />
              </section>

              <section
                v-if="temParticipacao"
                class="bloco"
                aria-label="Participação da cidade no estado"
              >
                <h3>{{ tituloParticipacao }}</h3>
                <GraficoBarras
                  :rotulos="rotulosHistorico"
                  :valores="valoresParticipacao!"
                  tipo="line"
                  cor="#84cc16"
                  altura="150px"
                />
              </section>
            </div>
          </template>
        </template>
      </div>
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
  max-height: 160px;
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

/* Abas internas: Hoje | Gráficos | Histórico. */
.abas {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  align-self: flex-start;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
}

.abas--compactas {
  padding: 2px;
}

.abas__botao {
  padding: 0.3rem 0.8rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  cursor: pointer;
}

.abas__botao:hover {
  color: var(--text);
}

.abas__botao.ativo {
  background: var(--accent);
  color: #1c1408;
  font-weight: 600;
}

/* Último foco registrado no recorte. */
.ultimo-foco {
  margin: 0;
  padding: 0.45rem 0.7rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  font-size: 0.82rem;
  color: var(--muted);
}

.ultimo-foco strong {
  color: var(--text);
}

/* Grade da aba Gráficos: 4 blocos em uma página. */
.grade-graficos {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 0.75rem;
}

.bloco--largo {
  grid-column: 1 / -1;
}

.bloco--grafico {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.bloco--grafico > *:not(h3) {
  flex: 1 1 auto;
  min-height: 0;
}

.aviso-grafico {
  flex: none;
  margin: 0.35rem 0 0;
  padding: 0.4rem 0.55rem;
  background: rgb(245 158 11 / 10%);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 0.75rem;
}

/* Aba Histórico. */
.historico {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.historico__barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.historico__fonte {
  color: var(--muted);
  font-size: 0.78rem;
}

.status-hist {
  color: var(--muted);
}

.status-hist--erro {
  color: var(--danger);
}

.bloco--historico {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bloco--historico > *:not(h3) {
  flex: 1 1 auto;
  min-height: 0;
}

/* Gráficos extras do histórico (FRP médio, participação no estado). */
.historico__extras {
  flex: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.75rem;
}

@media (max-width: 860px) {
  .grade-graficos {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(220px, 1fr));
  }
}
</style>
