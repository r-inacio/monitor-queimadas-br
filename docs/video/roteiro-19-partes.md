# Roteiro em 19 partes (texto do narrador)

Cada parte corresponde a um áudio que o narrador gravará. O vídeo de cada parte é
dimensionado pela duração estimada do texto (140 palavras por minuto).

## Audio 01
Seja bem vindo à apresentação da Interface gráfico online para visualização dados sobre queimadas no Brasil, este trabalho faz parte do projeto integrador do segundo de semestre de 2026 do curso de Computação da Univesp
A interface é publica, gratuita e acessível por qualquer navegador, sem necessidade de cadastro ou intalação.

## Audio 02
As queimadas e os incêndios florestais estão entre os maiores desafios ambientais e de saúde pública do país, atingindo biomas críticos e comunidades inteiras. O monitoramento desses eventos é essencial para decisões rápidas de órgãos públicos, pesquisadores e da sociedade civil. O problema que identificamos é a fragmentação das informações: os dados existem, mas chegam dispersos, em planilhas e formatos pouco amigáveis para quem precisa agir. Na prática, a Defesa Civil consulta vários sistemas diferentes para responder a um único chamado.

## Audio 03
Nosso objetivo foi desenvolver um site online com mapa interativo e dashboard, construído exclusivamente a partir dos dados abertos do Programa Queimadas do INPE (Instituto Nacional de Pesquisas Espaciais), transformando esses dados em uma ferramenta intuitiva para gestores públicos e cidadãos.

## Audio 04
Aqui vemos o mapa: cada estado recebe uma cor proporcional à quantidade de focos incendio do recorte, e o painel à esquerda permite filtrar por dia, estado, cidade, bioma e satélite. Tudo é atualizado na hora, sem recarregar a página, e o mesmo filtro vale para o mapa e para o dashboard.

## Audio 05
A metodologia adotada foi o Design Thinking, organizada em sete fases: contextualização, imersão, prototipagem, testes, validação, implementação e disponibilização.

## Audio 06
Na imersão realizamos entrevistas semiestruturadas com Luciano Gonçalves Leite, coordenador municipal de Proteção e Defesa Civil de Matão, que apontou dores concretas: dependência de planilhas manuais, informações fragmentadas e a necessidade de uma visão geográfica imediata dos focos.

## Audio 07
Em paralelo, fizemos uma análise documental dos dados abertos do INPE para entender estrutura, periodicidade e formato, além de uma checagem de qualidade que revelou valores nulos e campos incompletos.

## Audio 08
Os testes correram em duas frentes, usabilidade e verificação técnica, e cada versão do protótipo foi apresentada e ajustada a partir desse retorno, até chegarmos à solução final.

## Audio 09
Do ponto de vista tecnológico, o frontend foi desenvolvido em Vue.js com TypeScript, HTML5 e CSS. O mapa interativo usa a biblioteca Leaflet, com agrupamento de marcadores para lidar com milhares de pontos, e os gráficos usam Chart.js.

## Audio 10
O consumo dos dados é feito diretamente dos arquivos públicos do INPE pela Fetch API, com cache local e fallback para indisponibilidades temporárias.

## Audio 11
O código é versionado no GitHub, com integração contínua que executa verificação de tipos e build a cada alteração, e a publicação é feita na Vercel.

## Audio 12
O resultado foi uma aplicação completa. O dashboard foi organizado em três abas para não sobrecarregar a tela. Na aba Histórico, consolidamos séries anuais de 1998 a 2025 e mensais de 2023 a 2026, a partir dos arquivos oficiais do INPE: são quase 59 milhões de focos agregados.

## Audio 13
Os dados são baixados uma única vez, agregados por estado e por município e versionados no repositório. Os cards destacam o pico de 8,1 milhões de focos em 2024, o menor valor em 2000 e o total do período.

## Audio 14
A série permite comparar um estado com o país, ou um município com o seu estado, e o FRP médio mostra se a intensidade do fogo aumentou mesmo em anos com menos focos.

## Audio 15
No mapa, o coroplético virou a base da visualização: o território brasileiro é desenhado em uma rampa de cores vermelhas, do mais claro ao mais escuro conforme a quantidade de focos, com legenda unificada que explica as bolhas de agrupamento, as cores dos estados e as faixas de intensidade do fogo.

## Audio 16
Vale explicar que FRP é a potencia radiativa do fogo em MW: quanto maior, mais energia o fogo libera.

## Audio 17
Os focos individuais aparecem sobre o mapa, com o maior valor de potência radiativa destacado, e um clique permite filtrar por aquele município.

## Audio 18
Na aba Hoje, o gestor encontra o último foco registrado, os cartões de resumo, as tabelas por estado, bioma e satélite, o ranking dos quinze municípios com mais focos e o detalhamento paginado. Todo o recorte pode ser exportado em CSV, para compartilhar com a equipe.

## Audio 19
Como contribuição, entregamos uma ferramenta pública e gratuita que democratiza o acesso a dados ambientais oficiais, aplicando Design Thinking a um problema real de interesse social.
