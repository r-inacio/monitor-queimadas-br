<script setup lang="ts">
import type { Visao } from "../types";

const props = defineProps<{ modelValue: Visao }>();

const emit = defineEmits<{
  "update:modelValue": [value: Visao];
}>();

const opcoes: { valor: Visao; rotulo: string }[] = [
  { valor: "mapa", rotulo: "Mapa" },
  { valor: "dashboard", rotulo: "Dashboard" },
];

function escolher(valor: Visao) {
  if (valor !== props.modelValue) emit("update:modelValue", valor);
}
</script>

<template>
  <div class="view-toggle" role="group" aria-label="Escolher visualização">
    <button
      v-for="opcao in opcoes"
      :key="opcao.valor"
      type="button"
      class="view-toggle__botao"
      :class="{ ativo: modelValue === opcao.valor }"
      :aria-pressed="modelValue === opcao.valor"
      @click="escolher(opcao.valor)"
    >
      {{ opcao.rotulo }}
    </button>
  </div>
</template>

<style scoped>
.view-toggle {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 1000;
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  backdrop-filter: blur(4px);
  box-shadow: 0 4px 14px rgb(0 0 0 / 45%);
}

.view-toggle__botao {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.42rem 0.85rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.view-toggle__botao:hover {
  color: var(--text);
}

.view-toggle__botao.ativo {
  background: var(--accent);
  color: #1c1408;
  font-weight: 600;
}

.view-toggle__botao:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
