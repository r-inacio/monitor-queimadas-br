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

// Cache local por dia: o último carregamento bem-sucedido fica guardado
// e é usado como fallback quando o INPE fica indisponível.
const PREFIXO_CACHE = "focos_diario_cache_";

function lerCache(key: string): Foco[] | null {
  try {
    const bruto = localStorage.getItem(PREFIXO_CACHE + key);
    return bruto ? (JSON.parse(bruto) as Foco[]) : null;
  } catch {
    return null;
  }
}

function gravarCache(key: string, focos: Foco[]): void {
  try {
    localStorage.setItem(PREFIXO_CACHE + key, JSON.stringify(focos));
  } catch {
    // Quota do localStorage cheia (ou modo privado): cache dispensável.
  }
}

export async function fetchFocosDiarios(date: Date): Promise<Foco[]> {
  const key = formatDateKey(date);
  // O servidor do INPE permite CORS aberto, então buscamos direto:
  // funciona tanto no dev quanto na Vercel (o proxy /inpe-dados só
  // existia no `vite dev` e devolvia 404 em produção).
  const path = `https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_${key}.csv`;
  const response = await fetch(path);

  if (!response.ok) {
    const cache = lerCache(key);
    if (cache) return cache; // fallback: último dado válido do dia
    throw new Error(
      `Não foi possível carregar o CSV do dia ${toInputDate(date)} (${response.status}).`,
    );
  }

  const text = await response.text();
  const focos = parseCsv(text).map((row) => ({
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

  gravarCache(key, focos);
  return focos;
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

export function focosToCsv(focos: Foco[]): string {
  const headers = [
    "id",
    "lat",
    "lon",
    "data_hora_gmt",
    "satelite",
    "municipio",
    "estado",
    "bioma",
    "numero_dias_sem_chuva",
    "precipitacao",
    "risco_fogo",
    "frp",
  ];
  const escape = (value: string | number | null): string => {
    const text = value == null ? "" : String(value);
    return /[",;\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [headers.join(",")];
  for (const f of focos) {
    lines.push(
      [
        f.id,
        f.lat,
        f.lon,
        f.dataHoraGmt,
        f.satelite,
        f.municipio,
        f.estado,
        f.bioma,
        f.diasSemChuva,
        f.precipitacao,
        f.riscoFogo,
        f.frp,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}
