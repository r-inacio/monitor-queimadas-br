# Guia passo a passo: front de Queimadas (INPE)

Este texto ensina a construir, do zero, um web app que lê dados públicos do Programa Queimadas do INPE e mostra os focos de calor no mapa.

O repositório `queimadas-front` é o resultado final. Use-o para conferir se o seu código está no rumo, mas o objetivo aqui é você conseguir reproduzir a ideia sozinha.

Tempo estimado: uma tarde, se você já usou JavaScript e o terminal.

---

## 1. O que você vai construir

Um painel com duas partes:

1. **Lateral:** data, filtros (estado, bioma, satélite), totais e links das fontes.
2. **Mapa:** pontos de focos do dia, agrupados quando há muitos no mesmo lugar.

Não é uma cópia do [portal oficial](https://terrabrasilis.dpi.inpe.br/queimadas/portal/). É um **cliente** dos arquivos que o INPE já publica de graça.

```
Você escolhe a data
        ↓
O app baixa um CSV do servidor do INPE
        ↓
O JavaScript transforma cada linha em um objeto (foco)
        ↓
Filtros escondem o que não interessa
        ↓
O Leaflet desenha os pontos no Brasil
```

---

## 2. O que você precisa ter instalado

- **Node.js 20 ou mais novo** (traz o `npm`)
- Um editor (Cursor, VS Code, etc.)
- Navegador
- Git (opcional, mas recomendado)

Confira no terminal:

```bash
node -v
npm -v
```

Se o comando `node` não existir, instale pelo [site do Node.js](https://nodejs.org/) ou por um gerenciador da sua distro.

Conhecimentos úteis (não precisam ser avançados):

- HTML/CSS
- JavaScript ou TypeScript
- O que é uma requisição HTTP (`GET` de um arquivo)
- Noção de componentes (Vue)

---

## 3. Entenda os dados antes de escrever código

O portal mistura sistemas, relatórios e downloads. Para um front simples, ignore o BDQueimadas completo no começo. Comece pelos **CSV diários**.

### 3.1 Páginas oficiais

| O quê | URL |
| --- | --- |
| Portal | https://terrabrasilis.dpi.inpe.br/queimadas/portal/ |
| Catálogo de dados abertos | https://data.inpe.br/queimadas/dados-abertos/ |
| Pasta dos CSV diários (Brasil) | https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/ |

Abra a pasta do CSV no navegador. Você vai ver arquivos no padrão:

```text
focos_diario_br_AAAAMMDD.csv
```

Exemplo: `focos_diario_br_20260904.csv` é o dia 4 de setembro de 2026.

### 3.2 Olhe uma linha de verdade

Baixe um arquivo recente e abra no editor ou rode:

```bash
curl -sS "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_20260904.csv" | head -n 5
```

O cabeçalho (pode evoluir no futuro; confira no arquivo atual) é deste tipo:

```text
id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais,municipio_id,estado_id,pais_id,numero_dias_sem_chuva,precipitacao,risco_fogo,bioma,frp
```

Cada linha seguinte é **um foco**: um pixel de fogo ativo detectado por satélite, com município, bioma, horário em GMT e, quando existir, FRP (energia do fogo) e risco.

Campos vazios são normais. Trate número ausente como `null`, não como `0`.

### 3.3 Por que não “chamar a API JSON”?

Não existe um único endpoint oficial, estável e documentado como `/api/focos?estado=...` para esse produto. O que é público e previsível hoje são:

- arquivos CSV / KML no dataserver
- serviços geoespaciais (WMS/WFS) em outro momento

Por isso a v1 baixa o CSV do dia e processa no navegador.

### 3.4 CORS (o problema que pega todo mundo)

Se o frontend em `http://localhost:5173` pedir o CSV direto ao INPE, o navegador **bloqueia**: o servidor do INPE não autoriza origem cruzada.

Solução em desenvolvimento: o **Vite faz de intermediário**. O browser pede `/inpe-dados/...` no localhost; o Vite busca o arquivo no INPE e devolve. Para o browser, parece o mesmo site.

Em produção você precisaria de um backend ou de outro proxy. Não pule isso.

---

## 4. Crie o projeto Vue

No terminal:

```bash
npm create vite@latest queimadas-front -- --template vue-ts
cd queimadas-front
npm install
npm install leaflet leaflet.markercluster
npm install -D @types/leaflet @types/leaflet.markercluster
npm run dev
```

Abra o endereço que o Vite mostrar (em geral `http://localhost:5173`). Se a tela padrão do Vite aparecer, o ambiente está ok.

Estrutura que você vai usar:

```text
queimadas-front/
  vite.config.ts          # proxy para o INPE
  src/
    types.ts              # formato de um foco
    lib/csv.ts            # texto CSV → linhas
    lib/queimadas.ts      # baixa e mapeia o CSV do dia
    components/
      FireMap.vue         # Leaflet
      FiltersPanel.vue    # filtros e estatísticas
    App.vue               # liga tudo
    main.ts
    style.css
```

---

## 5. Configure o proxy

Edite `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/inpe-dados": {
        target: "https://dataserver-coids.inpe.br",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/inpe-dados/, ""),
      },
    },
  },
});
```

Reinicie o `npm run dev` depois de mudar o Vite.

Teste: no navegador, com o app rodando, abra algo como:

```text
http://localhost:5173/inpe-dados/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_20260904.csv
```

Se aparecer texto CSV, o proxy está funcionando. Se der 404, a data pode não ter arquivo ainda (o dia atual às vezes só cresce de madrugada / ao longo do dia).

---

## 6. Modele um foco

Crie `src/types.ts`. Isso é o contrato do resto do app:

- `lat` / `lon` para o mapa
- textos para filtro e popup
- números opcionais (`riscoFogo`, `frp`, chuva)

Valores vazios no CSV viram `number | null`.

Crie também `src/lib/csv.ts`: uma função `parseCsv(text)` que:

1. Separa linhas
2. Usa a primeira como nomes de coluna
3. Devolve um array de objetos `{ coluna: valor }`

Não precisa de biblioteca. Trate aspas se quiser ser correto; o CSV do INPE é simples (vírgulas, sem HTML).

---

## 7. Busque o CSV do dia escolhido

Em `src/lib/queimadas.ts`:

1. Converta a data do `<input type="date">` (`2026-09-04`) para o nome do arquivo (`20260904`).
2. Monte a URL **relativa** (por causa do proxy):

   ```text
   /inpe-dados/queimadas/queimadas/focos/csv/diario/Brasil/focos_diario_br_20260904.csv
   ```

3. `fetch` → `response.text()` → `parseCsv`.
4. Mapeie as colunas para o tipo `Foco` (`row.lat` → `Number`, etc.).
5. Descarte linhas sem latitude/longitude válidas.
6. Se `response.ok` for falso, lance um erro claro (“não há CSV desse dia”).

Funções extras que valem a pena no mesmo arquivo:

- `uniqueSorted`: lista de estados/biomas/satélites para os `<select>`
- `countBy`: ranking (“Mato Grosso: 1200 focos”)

Teste isolado: no `App.vue` temporário, no `onMounted`, chame `fetchFocosDiarios(new Date())` e faça `console.log` do `length` e do primeiro item. Só avance quando isso funcionar.

---

## 8. Monte o mapa (Leaflet)

Instale e importe o CSS do Leaflet. Sem o CSS, o mapa “quebra” (quadrados cinza, controles tortos).

Em `FireMap.vue`:

1. Um `<div>` com altura definida (o Leaflet **precisa** de altura; `height: 100%` na cadeia até o `html`/`body`).
2. No `onMounted`, crie `L.map(div).setView([-14.2, -51.9], 4)` (centro aproximado do Brasil).
3. Camada de fundo OpenStreetMap (dê crédito no `attribution`, junto com INPE).
4. Para cada foco, `L.circleMarker([lat, lon])` — ícone de pin padrão do Leaflet é desnecessário aqui.
5. Popup com município, estado, bioma, satélite, horário, FRP, risco.
6. Cor pelo FRP (ex.: âmbar baixo, vermelho alto) para o olho achar os focos mais intensos.

**Agrupamento:** um dia de setembro pode ter milhares de pontos. Sem cluster o navegador trava. Use `leaflet.markercluster`:

- `import "leaflet.markercluster"`
- `L.markerClusterGroup({ chunkedLoading: true })`
- `addLayers` com todos os círculos
- Quando os focos mudarem (`watch`), `clearLayers` e desenhe de novo
- No `onBeforeUnmount`, `map.remove()` para não vazar memória

Tipos TypeScript: depois do import do plugin, `L.markerClusterGroup` passa a existir. Se o compilador reclamar, declare o módulo em `src/vite-env.d.ts`:

```ts
declare module "leaflet.markercluster";
```

---

## 9. Filtros e estatísticas

Componente `FiltersPanel.vue` (só apresentação):

- `input type="date"`
- três `select`: estado, bioma, satélite, cada um com opção “Todos”
- mensagem de carregando / erro
- “X focos filtrados de Y no dia”
- listas dos estados e biomas mais frequentes
- links para portal, dados abertos e pasta do CSV

O pai (`App.vue`) guarda o estado:

```ts
const data = ref("2026-09-04"); // formato do input date
const filtros = ref({ estado: "", bioma: "", satelite: "" });
const focos = ref<Foco[]>([]);
```

`focosFiltrados` é um `computed`: percorre `focos` e mantém a linha se o filtro estiver vazio ou igual ao campo.

Quando a **data** muda, busque o CSV de novo e zere os filtros (os estados da lista antiga não valem para outro dia).

Quando só o **filtro** muda, não baixe de novo: filtre o array que já está na memória.

---

## 10. Encaixe o layout

`App.vue` em grade: ~360px de painel + mapa no resto. Em tela estreita, painel em cima e mapa com altura mínima (~55vh).

`html`, `body`, `#app` com `height: 100%` e `margin: 0`. Tema escuro combina com “sala de situação”; não é obrigatório.

Fluxo final:

```ts
watch(data, carregar);
onMounted(carregar);
```

`carregar` liga `carregando`, chama `fetchFocosDiarios`, preenche `focos` ou `erro`.

O mapa recebe **somente** `focosFiltrados`.

---

## 11. Checklist para saber se está pronto

- [ ] `npm run dev` abre o app
- [ ] O CSV abre via `/inpe-dados/...` no localhost
- [ ] O mapa mostra o Brasil (não uma tela cinza)
- [ ] Há pontos (ou clusters) num dia com arquivo grande
- [ ] Clicar num ponto mostra município e satélite
- [ ] Mudar estado reduz a quantidade de pontos
- [ ] Mudar a data dispara um novo download
- [ ] Um dia sem arquivo mostra erro, não quebra a página
- [ ] No rodapé há crédito INPE e OpenStreetMap

---

## 12. Problemas comuns

| Sintoma | Causa típica |
| --- | --- |
| CSV no console com erro de CORS | Fetch na URL absoluta do INPE, sem proxy |
| Mapa cinza / tamanho zero | Div sem altura; `#app` sem `height: 100%` |
| Ícones de pin quebrados | Você usou `L.marker` sem configurar imagens do Leaflet; prefira `circleMarker` |
| Página lenta / travou | Sem cluster, dezenas de milhares de DOM nodes |
| “Não foi possível carregar o CSV” | Data futura, arquivo ainda não publicado, ou nome `focos_diario_br_` errado |
| Números `NaN` no popup | Campo vazio no CSV convertido com `Number("")` sem checagem |
| Proxy não atualiza | Esqueceu de reiniciar o Vite |

---

## 13. Boas práticas (dados públicos)

- Sempre deixe claro que os dados são do **INPE / Programa Queimadas**.
- Horário dos focos é **GMT**, não horário de Brasília.
- Foco de satélite **não é** área queimada mapeada. É detecção de calor no pixel.
- Não grave o CSV enorme no git.
- Não trate o front como fonte oficial; o portal do INPE continua sendo a referência.

---

## 14. Depois que a v1 funcionar

Ordem sugerida, da mais fácil para a mais trabalhosa:

1. **Últimos 10 minutos** — pasta `focos/csv/10min/` no mesmo dataserver (vários arquivos por hora).
2. **América do Sul** — há CSV em `diario/America_Sul/`, não só Brasil.
3. **WMS** — colocar uma camada de imagem do GeoServer por cima do mapa, sem baixar cada ponto.
4. **Risco de fogo / área queimada** — GeoTIFF e shapefile; em geral pedem biblioteca raster ou um backend.
5. **Backend** — se o CSV diário ficar pesado demais para o browser: o servidor baixa, filtra e devolve GeoJSON enxuto.

---

## 15. Onde olhar neste repositório

| Arquivo | Papel |
| --- | --- |
| `vite.config.ts` | Proxy `/inpe-dados` |
| `src/types.ts` | Modelo do foco |
| `src/lib/csv.ts` | Parser |
| `src/lib/queimadas.ts` | Download + mapeamento + agregações |
| `src/components/FireMap.vue` | Mapa e cluster |
| `src/components/FiltersPanel.vue` | UI dos filtros |
| `src/App.vue` | Estado, fetch, filtro |

Leia nessa ordem. Cada arquivo faz uma coisa só de propósito: assim dá para ensinar (e para você voltar daqui a meses) sem desmontar um único arquivo gigante.
