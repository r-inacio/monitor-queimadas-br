import { parseCsv } from "./csv";
import type { Foco } from "../types";

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromInputDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchFocosDiarios(date: Date): Promise<Foco[]> {
  const key = formatDateKey(date);
  const path = `/inpe-dados/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_${key}.csv`;
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar o CSV do dia ${toInputDate(date)} (${response.status}).`,
    );
  }

  const text = await response.text();
  return parseCsv(text).map((row) => ({
    id: row.id,
    lat: Number(row.lat),
    lon: Number(row.lon),
    dataHoraGmt: row.data_hora_gmt,
    satelite: row.satelite,
    municipio: row.municipio,
    estado: row.estado,
    pais: row.pais,
    diasSemChuva: parseNumber(row.numero_dias_sem_chuva),
    precipitacao: parseNumber(row.precipitacao),
    riscoFogo: parseNumber(row.risco_fogo),
    bioma: row.bioma,
    frp: parseNumber(row.frp),
  })).filter((foco) => Number.isFinite(foco.lat) && Number.isFinite(foco.lon));
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function countBy(values: string[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}
