export type Foco = {
  id: string;
  lat: number;
  lon: number;
  dataHoraGmt: string;
  satelite: string;
  municipio: string;
  estado: string;
  pais: string;
  diasSemChuva: number | null;
  precipitacao: number | null;
  riscoFogo: number | null;
  bioma: string;
  frp: number | null;
};

export type Filtros = {
  estado: string;
  municipio: string;
  bioma: string;
  satelite: string;
};

export type Visao = "mapa" | "dashboard";

export type AbaDashboard = "hoje" | "graficos" | "historico";

export type RegistroHistorico = {
  ano?: number;
  mes?: string;
  total: number;
  estados: Record<string, number>;
  biomas: Record<string, number>;
  // municipios[ESTADO][MUNICIPIO] = [contagem, frpMedio, frpMax]
  // (frpMedio/frpMax = null quando nenhum foco tem FRP no período)
  municipios: Record<string, Record<string, [number, number | null, number | null]>>;
  // frp_estados[ESTADO] = [contagem, frpMedio, frpMax]
  frp_estados: Record<string, [number, number | null, number | null]>;
};
