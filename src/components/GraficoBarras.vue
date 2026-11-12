<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";

const props = defineProps<{
  rotulos: string[];
  valores: number[];
  horizontal?: boolean;
  cor?: string;
  altura?: string;
  tipo?: "bar" | "line";
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let grafico: Chart | null = null;

function corDe(): string {
  return props.cor ?? "#f59e0b";
}

onMounted(() => {
  if (!canvas.value) return;
  grafico = new Chart(canvas.value, {
    type: props.tipo ?? "bar",
    data: {
      labels: [...props.rotulos],
      datasets: [
        {
          data: [...props.valores],
          backgroundColor: corDe(),
          borderColor: props.tipo === "line" ? corDe() : undefined,
          borderWidth: props.tipo === "line" ? 2 : undefined,
          tension: props.tipo === "line" ? 0.25 : undefined,
          pointRadius: props.tipo === "line" ? 2 : undefined,
          fill: props.tipo === "line",
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: props.horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: "#9aa894", font: { size: 10 }, maxRotation: 45 },
          grid: { color: "rgba(42, 53, 40, 0.6)" },
        },
        y: {
          ticks: { color: "#9aa894", font: { size: 10 } },
          grid: { color: "rgba(42, 53, 40, 0.6)" },
        },
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
    grafico.data.datasets[0].backgroundColor = corDe();
    grafico.update();
  },
);

onBeforeUnmount(() => {
  grafico?.destroy();
  grafico = null;
});
</script>

<template>
  <div class="grafico-barras" :style="{ height: altura ?? '100%' }">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.grafico-barras {
  position: relative;
  min-height: 0;
}
</style>
