<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";

// Série histórica pronta (rótulos e valores vêm do DashboardView,
// que decide se a série é nacional, de um estado ou de uma cidade).
const props = defineProps<{
  rotulos: string[];
  valores: number[];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let grafico: Chart | null = null;

const escala = new Intl.NumberFormat("pt-BR", { notation: "compact" });
const escalaCompleta = new Intl.NumberFormat("pt-BR");

const estatisticas = computed(() => {
  const totais = props.valores;
  if (!totais.length) return null;
  const max = Math.max(...totais);
  const min = Math.min(...totais);
  const indicePico = totais.indexOf(max);
  const indiceFundo = totais.indexOf(min);
  return [
    {
      rotulo: "Pico",
      valor: `${escala.format(max)} (${props.rotulos[indicePico] ?? "—"})`,
    },
    {
      rotulo: "Menor",
      valor: `${escala.format(min)} (${props.rotulos[indiceFundo] ?? "—"})`,
    },
    {
      rotulo: "Total do histórico",
      valor: escalaCompleta.format(totais.reduce((a, b) => a + b, 0)),
    },
  ];
});

const serieVazia = computed(
  () => props.valores.length > 0 && props.valores.every((v) => v === 0),
);

onMounted(() => {
  if (!canvas.value) return;
  grafico = new Chart(canvas.value, {
    type: "line",
    data: {
      labels: [...props.rotulos],
      datasets: [
        {
          data: [...props.valores],
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#9aa894", font: { size: 9 }, maxTicksLimit: 16 }, grid: { color: "rgba(42, 53, 40, 0.6)" } },
        y: { ticks: { color: "#9aa894", font: { size: 10 } }, grid: { color: "rgba(42, 53, 40, 0.6)" } },
      },
    },
  });
});

watch(
  () => [props.rotulos, props.valores] as const,
  () => {
    if (!grafico) return;
    grafico.data.labels = [...props.rotulos];
    grafico.data.datasets[0].data = [...props.valores];
    grafico.update();
  },
);

onBeforeUnmount(() => {
  grafico?.destroy();
  grafico = null;
});
</script>

<template>
  <div class="grafico-historico">
    <p v-if="serieVazia" class="grafico-historico__vazio">
      Sem registros históricos para este recorte no histórico agregado.
    </p>
    <template v-else>
      <ul v-if="estatisticas" class="grafico-historico__estatisticas">
        <li v-for="item in estatisticas" :key="item.rotulo">
          <span>{{ item.rotulo }}</span>
          <strong>{{ item.valor }}</strong>
        </li>
      </ul>
      <div class="grafico-historico__area">
        <canvas ref="canvas" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.grafico-historico {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
}

.grafico-historico__vazio {
  margin: auto 0;
  color: var(--muted);
}

/* Cards Pico/Menor/Total em destaque, proporcionais e centralizados. */
.grafico-historico__estatisticas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.grafico-historico__estatisticas li {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.7rem 0.5rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  text-align: center;
}

.grafico-historico__estatisticas span {
  color: var(--muted);
  font-size: 0.75rem;
}

.grafico-historico__estatisticas strong {
  font-size: 1.15rem;
}

/* Gráfico menor, abaixo dos cards. */
.grafico-historico__area {
  flex: 0 1 42%;
  min-height: 150px;
  position: relative;
}
</style>
