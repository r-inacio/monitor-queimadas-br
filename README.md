# Queimadas Front

Front web para os **dados abertos** do [Programa Queimadas do INPE](https://terrabrasilis.dpi.inpe.br/queimadas/portal/).

A primeira versão lê o CSV diário de focos no Brasil e mostra os pontos no mapa, com filtro por data, estado, bioma e satélite.

## Dados usados

| Fonte | Uso |
| --- | --- |
| [CSV diário (Brasil)](https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/) | Focos do dia: lat/lon, satélite, município, estado, bioma, FRP, risco de fogo |
| [Dados abertos](https://data.inpe.br/queimadas/dados-abertos/) | Catálogo (10 min, KML, área queimada, risco) |
| [Portal Queimadas](https://terrabrasilis.dpi.inpe.br/queimadas/portal/) | Sistemas e relatórios oficiais |

O app não replica o BDQueimadas inteiro: consome arquivos públicos e agrega no cliente.

**Quer montar isso do zero?** Siga o [guia passo a passo](docs/guia-de-desenvolvimento.md): dados do INPE, CORS/proxy, Vue, CSV, Leaflet e filtros.

## Como rodar

É preciso Node.js 20+ (não estava instalado neste ambiente na criação do projeto).

```bash
cd ~/Projects/queimadas-front
npm install
npm run dev
```

O Vite faz proxy de `/inpe-dados` para `https://dataserver-coids.inpe.br`, para evitar CORS no desenvolvimento.

## Próximos passos possíveis

- Camada WMS/WFS do GeoServer de queimadas
- Focos de 10 minutos (quase tempo real)
- Área queimada e risco de fogo previsto
- Backend leve se o CSV diário ficar grande demais para o browser
