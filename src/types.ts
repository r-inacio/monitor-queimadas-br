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
  bioma: string;
  satelite: string;
};
