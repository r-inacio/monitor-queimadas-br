# -*- coding: utf-8 -*-
"""Gera os cartões de título/seção do vídeo na paleta do projeto."""
from PIL import Image, ImageDraw, ImageFont

L, A = 1280, 720
BG, PAINEL, TEXTO, MUTED, ACCENT = "#10140f", "#171d16", "#e8efe4", "#9aa894", "#f59e0b"
FONTE = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
FONTE_REG = "/usr/share/fonts/TTF/DejaVuSans.ttf"

def fonte(tam, negrito=True):
    return ImageFont.truetype(FONTE if negrito else FONTE_REG, tam)

def centralizado(draw, y, texto, tam, cor=TEXTO, negrito=True):
    f = fonte(tam, negrito)
    largura = draw.textbbox((0, 0), texto, font=f)[2]
    draw.text(((L - largura) / 2, y), texto, font=f, fill=cor)

def cartao_abertura():
    img = Image.new("RGB", (L, A), BG)
    d = ImageDraw.Draw(img)
    # faixa superior âmbar
    d.rectangle([0, 0, L, 8], fill=ACCENT)
    centralizado(d, 120, "UNIVERSIDADE VIRTUAL DO ESTADO DE SÃO PAULO", 20, MUTED)
    centralizado(d, 200, "Interface gráfica online para", 46)
    centralizado(d, 258, "visualização de dados sobre", 46)
    centralizado(d, 316, "queimadas no Brasil", 46, ACCENT)
    d.line([(L/2 - 60, 400), (L/2 + 60, 400)], fill=ACCENT, width=3)
    centralizado(d, 430, "Projeto Integrador  ·  Computação  ·  Grupo 20", 24, TEXTO, False)
    centralizado(d, 478, "Anderson Ricardo de Lima Magni  ·  Amanda Tavares Soares da Silva", 17, MUTED, False)
    centralizado(d, 504, "Raphael Rodrigues Inacio da Silva  ·  Vinicius de Queiroz Soares", 17, MUTED, False)
    centralizado(d, 590, "Dados abertos do Programa Queimadas — INPE", 18, MUTED, False)
    centralizado(d, 640, "monitor-queimadas-br.vercel.app", 20, ACCENT)
    return img

def cartao_secao(numero, titulo, subtitulo, itens=None):
    img = Image.new("RGB", (L, A), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, L, 8], fill=ACCENT)
    # número grande à esquerda
    d.text((90, 250), numero, font=fonte(96), fill=ACCENT)
    d.text((95, 380), titulo, font=fonte(44), fill=TEXTO)
    d.text((95, 445), subtitulo, font=fonte(20, False), fill=MUTED)
    if itens:
        y = 505
        for item in itens:
            d.text((97, y), "•", font=fonte(18), fill=ACCENT)
            d.text((118, y), item, font=fonte(18, False), fill=TEXTO)
            y += 30
    return img

def cartao_encerramento():
    img = Image.new("RGB", (L, A), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, L, 8], fill=ACCENT)
    centralizado(d, 190, "Obrigado!", 56, ACCENT)
    centralizado(d, 290, "Ferramenta pública, gratuita e sem cadastro", 24, TEXTO, False)
    centralizado(d, 330, "para acompanhar as queimadas em todo o Brasil", 24, TEXTO, False)
    d.line([(L/2 - 60, 400), (L/2 + 60, 400)], fill=ACCENT, width=3)
    centralizado(d, 435, "monitor-queimadas-br.vercel.app", 30, ACCENT)
    centralizado(d, 500, "Dados: Programa Queimadas (INPE)  ·  Vue.js, TypeScript, Leaflet, Chart.js", 17, MUTED, False)
    centralizado(d, 560, "UNIVESP  ·  Projeto Integrador  ·  Grupo 20  ·  2026", 17, MUTED, False)
    return img

cartoes = {
    "01-abertura": cartao_abertura(),
    "02-objetivo": cartao_secao("02", "Objetivo", "Site público com mapa interativo e dashboard, a partir dos dados abertos do INPE",
        ["Mapa interativo com focos de calor georreferenciados",
         "Dashboard com incidência por estado, bioma e satélite",
         "Acesso livre, sem cadastro, para gestores e cidadãos"]),
    "03-metodologia": cartao_secao("03", "Metodologia", "Design Thinking: imersão, prototipagem e testes iterativos",
        ["Entrevista com a Defesa Civil de Matão (Luciano Gonçalves Leite)",
         "Análise documental dos dados abertos do INPE",
         "Ciclos de protótipo avaliados e ajustados com o usuário"]),
    "04-stack": cartao_secao("04", "Stack utilizada", "Aplicação frontend com consumo direto de dados abertos",
        ["Vue.js + TypeScript + HTML5 + CSS", "Leaflet (mapa) e Chart.js (gráficos)",
         "Fetch API, cache local e fallback", "GitHub + GitHub Actions (CI) + Vercel (deploy)"]),
    "05-resultado": cartao_secao("05", "Resultado final", "Mapa coroplético, dashboard em abas e histórico de 1998 a 2025",
        ["Dashboard em três abas: Hoje, Gráficos e Histórico",
         "Histórico com quase 59 milhões de focos agregados",
         "Filtros por dia, estado, cidade, bioma e satélite",
         "Exportação do recorte em CSV"]),
    "06-encerramento": cartao_encerramento(),
}

for nome, img in cartoes.items():
    img.save(f".video/cards/{nome}.png")
    print("cartão:", nome)
