# Roteiro de narração — Vídeo de apresentação do Projeto Integrador

**Projeto:** Interface gráfica online para visualização de dados sobre queimadas no Brasil
**Disciplina:** Projeto Integrador (Computação) — UNIVESP
**Duração:** 5 minutos (5:00)
**Formato do vídeo:** 1280×720, navegação real no site, com cartões de seção
**Site:** https://monitor-queimadas-br.vercel.app/

---

## Como usar este roteiro

1. O vídeo já está **sincronizado com os timecodes** da tabela abaixo.
2. Leia o texto da coluna **Narração** no ritmo indicado. A coluna **Tela** diz o que
   está aparecendo — use como referência para pausas e ênfases.
3. Ritmo médio: **140 palavras por minuto**. Se você falar mais devagar, ensaie
   antes: cada bloco tem margem de ±3 segundos.
4. No fim há uma **versão corrida** (texto único) para leitura direta, sem a tabela.

**Pronúncia:** INPE (lê-se "INPÊ"), Vercel ("vérsel"), Leaflet ("líflet"),
Chart.js ("tchárt ponto jota-éssi"), FRP (soletre "éfe-érre-pê" ou diga
"potência radiativa do fogo"), Vue.js ("viú ponto jota-éssi").

---

## Roteiro com timecodes

| Tempo | Seção | Tela | Narração |
|---|---|---|---|
| **0:00–0:20** | Abertura | Cartão de título: nome do projeto, UNIVESP, integrantes | "Este é o Projeto Integrador do grupo 20: uma interface gráfica online para visualização de dados sobre queimadas no Brasil. A aplicação é pública, gratuita e acessível por qualquer navegador, sem necessidade de cadastro." |
| **0:20–0:55** | Justificativa | Mapa do Brasil com os estados coloridos por quantidade de focos | "As queimadas e os incêndios florestais estão entre os maiores desafios ambientais e de saúde pública do país, atingindo biomas críticos e comunidades inteiras. O monitoramento desses eventos é essencial para decisões rápidas de órgãos públicos, pesquisadores e da sociedade civil. O problema que identificamos é a fragmentação das informações: os dados existem, mas chegam dispersos, em planilhas e formatos pouco amigáveis para quem precisa agir." |
| **0:55–1:30** | Objetivo | Mapa com filtro de estado aplicado e lista de cidades | "Nosso objetivo foi desenvolver um site online com mapa interativo e dashboard, construído exclusivamente a partir dos dados abertos do Programa Queimadas do INPE, transformando esses dados em uma ferramenta intuitiva para gestores públicos e cidadãos. Aqui vemos o mapa: cada estado recebe uma cor proporcional à quantidade de focos do recorte, e o painel à esquerda permite filtrar por dia, estado, cidade, bioma e satélite." |
| **1:30–2:15** | Metodologia | Dashboard na aba Hoje, com cartões e tabelas | "A metodologia adotada foi o Design Thinking, em um ciclo iterativo de imersão, prototipagem e testes. Na fase de imersão realizamos entrevistas semiestruturadas com Luciano Gonçalves Leite, coordenador municipal de Proteção e Defesa Civil de Matão, que apontou dores concretas: dependência de planilhas manuais, informações fragmentadas e a necessidade de uma visão geográfica imediata dos focos. Cada versão do protótipo foi apresentada e ajustada a partir desse retorno, até chegarmos à solução final." |
| **2:15–2:50** | Stack | Aba Gráficos com os gráficos de barras e de intensidade | "Do ponto de vista tecnológico, o frontend foi desenvolvido em Vue.js com TypeScript, HTML5 e CSS. O mapa interativo usa a biblioteca Leaflet, com agrupamento de marcadores para lidar com milhares de pontos, e os gráficos usam Chart.js. O consumo dos dados é feito diretamente dos arquivos públicos do INPE pela Fetch API, com cache local e fallback para indisponibilidades temporárias. O código é versionado no GitHub, com integração contínua que executa verificação de tipos e build a cada alteração, e a publicação é feita na Vercel." |
| **2:50–3:45** | Resultado: histórico | Aba Histórico, gráfico anual e cards de pico, menor e total | "O resultado é uma aplicação completa. O dashboard foi organizado em três abas para não sobrecarregar a tela. Na aba Histórico, consolidamos séries anuais de 1998 a 2025 e mensais de 2023 a 2026, a partir dos dados oficiais do INPE: são quase 59 milhões de focos agregados. Os cards destacam o pico de 8,1 milhões de focos em 2024, o menor valor em 2000 e o total do período, permitindo comparações temporais por estado e por município." |
| **3:45–4:40** | Resultado: mapa e filtros | Navegação: mapa, filtro por cidade, dashboard Hoje, exportação | "No mapa, o coroplético virou a base da visualização: o território brasileiro é desenhado em uma rampa de vermelhos, do mais claro ao mais escuro conforme a quantidade de focos, com legenda unificada que explica as bolhas de agrupamento, as cores dos estados e as faixas de intensidade do fogo. Os focos individuais aparecem sobre o mapa, com o maior valor de potência radiativa destacado, e um clique permite filtrar por aquele município. Na aba Hoje, o gestor encontra o último foco registrado, os cartões de resumo, as tabelas por estado, bioma e satélite, o ranking dos quinze municípios com mais focos e o detalhamento paginado. Todo o recorte pode ser exportado em CSV, para compartilhar com a equipe." |
| **4:40–5:00** | Encerramento | Cartão final com a URL e créditos | "Como contribuição, entregamos uma ferramenta pública e gratuita que democratiza o acesso a dados ambientais oficiais, aplicando Design Thinking a um problema real de interesse social. O site está disponível em monitor-queimadas-br.vercel.app. Obrigado!" |

---

## Versão corrida (para leitura direta)

> **0:00** — Este é o Projeto Integrador do grupo 20: uma interface gráfica online para
> visualização de dados sobre queimadas no Brasil. A aplicação é pública, gratuita e
> acessível por qualquer navegador, sem necessidade de cadastro.
>
> **0:20** — As queimadas e os incêndios florestais estão entre os maiores desafios
> ambientais e de saúde pública do país, atingindo biomas críticos e comunidades inteiras.
> O monitoramento desses eventos é essencial para decisões rápidas de órgãos públicos,
> pesquisadores e da sociedade civil. O problema que identificamos é a fragmentação das
> informações: os dados existem, mas chegam dispersos, em planilhas e formatos pouco
> amigáveis para quem precisa agir.
>
> **0:55** — Nosso objetivo foi desenvolver um site online com mapa interativo e dashboard,
> construído exclusivamente a partir dos dados abertos do Programa Queimadas do INPE,
> transformando esses dados em uma ferramenta intuitiva para gestores públicos e cidadãos.
> Aqui vemos o mapa: cada estado recebe uma cor proporcional à quantidade de focos do
> recorte, e o painel à esquerda permite filtrar por dia, estado, cidade, bioma e satélite.
>
> **1:30** — A metodologia adotada foi o Design Thinking, em um ciclo iterativo de imersão,
> prototipagem e testes. Na fase de imersão realizamos entrevistas semiestruturadas com
> Luciano Gonçalves Leite, coordenador municipal de Proteção e Defesa Civil de Matão, que
> apontou dores concretas: dependência de planilhas manuais, informações fragmentadas e a
> necessidade de uma visão geográfica imediata dos focos. Cada versão do protótipo foi
> apresentada e ajustada a partir desse retorno, até chegarmos à solução final.
>
> **2:15** — Do ponto de vista tecnológico, o frontend foi desenvolvido em Vue.js com
> TypeScript, HTML5 e CSS. O mapa interativo usa a biblioteca Leaflet, com agrupamento de
> marcadores para lidar com milhares de pontos, e os gráficos usam Chart.js. O consumo dos
> dados é feito diretamente dos arquivos públicos do INPE pela Fetch API, com cache local e
> fallback para indisponibilidades temporárias. O código é versionado no GitHub, com
> integração contínua que executa verificação de tipos e build a cada alteração, e a
> publicação é feita na Vercel.
>
> **2:50** — O resultado é uma aplicação completa. O dashboard foi organizado em três abas
> para não sobrecarregar a tela. Na aba Histórico, consolidamos séries anuais de 1998 a 2025
> e mensais de 2023 a 2026, a partir dos dados oficiais do INPE: são quase 59 milhões de
> focos agregados. Os cards destacam o pico de 8,1 milhões de focos em 2024, o menor valor
> em 2000 e o total do período, permitindo comparações temporais por estado e por município.
>
> **3:45** — No mapa, o coroplético virou a base da visualização: o território brasileiro é
> desenhado em uma rampa de vermelhos, do mais claro ao mais escuro conforme a quantidade de
> focos, com legenda unificada que explica as bolhas de agrupamento, as cores dos estados e
> as faixas de intensidade do fogo. Os focos individuais aparecem sobre o mapa, com o maior
> valor de potência radiativa destacado, e um clique permite filtrar por aquele município.
> Na aba Hoje, o gestor encontra o último foco registrado, os cartões de resumo, as tabelas
> por estado, bioma e satélite, o ranking dos quinze municípios com mais focos e o
> detalhamento paginado. Todo o recorte pode ser exportado em CSV, para compartilhar com a
> equipe.
>
> **4:40** — Como contribuição, entregamos uma ferramenta pública e gratuita que democratiza
> o acesso a dados ambientais oficiais, aplicando Design Thinking a um problema real de
> interesse social. O site está disponível em monitor-queimadas-br.vercel.app. Obrigado!

---

## Observações para quem grava

- **Áudio:** grave a narração separadamente (celular em ambiente silencioso já serve) e
  depois sincronize com o vídeo pelo primeiro segundo do cartão de abertura.
- **Se o tempo passar de 5:00:** corte frases do bloco 3:45–4:40 (é o mais longo e
  sobrevive a cortes). Se ficar curto, aumente as pausas entre as seções.
- **Ensaio:** leia uma vez em voz alta cronometrando; ajuste o ritmo antes de gravar.
