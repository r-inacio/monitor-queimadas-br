# -*- coding: utf-8 -*-
"""Cartões de título/seção em 1920x1080, na paleta do projeto."""
from PIL import Image, ImageDraw, ImageFont

L, A = 1920, 1080
BG, TEXTO, MUTED, ACCENT = "#10140f", "#e8efe4", "#9aa894", "#f59e0b"
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
    d.rectangle([0, 0, L, 12], fill=ACCENT)
    centralizado(d, 180, "UNIVERSIDADE VIRTUAL DO ESTADO DE SÃO PAULO", 30, MUTED)
    centralizado(d, 300, "Interface gráfica online para", 69)
    centralizado(d, 387, "visualização de dados sobre", 69)
    centralizado(d, 474, "queimadas no Brasil", 69, ACCENT)
    d.line([(L/2 - 90, 600), (L/2 + 90, 600)], fill=ACCENT, width=5)
    centralizado(d, 663, "Anderson Ricardo de Lima Magni  ·  Amanda Tavares Soares da Silva", 26, MUTED, False)
    centralizado(d, 705, "Raphael Rodrigues Inacio da Silva  ·  Vinicius de Queiroz Soares", 26, MUTED, False)
    centralizado(d, 900, "Projeto Integrador  ·  Computação  ·  PJI410-DRP10", 33, ACCENT)
    return img

def cartao_secao(titulo, subtitulo, itens=None):
    img = Image.new("RGB", (L, A), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, L, 12], fill=ACCENT)
    d.rectangle([135, 300, 234, 307], fill=ACCENT)
    d.text((132, 340), titulo, font=fonte(84), fill=ACCENT)
    d.text((137, 470), subtitulo, font=fonte(30, False), fill=MUTED)
    if itens:
        y = 580
        for item in itens:
            d.text((140, y), "•", font=fonte(28), fill=ACCENT)
            d.text((176, y), item, font=fonte(28, False), fill=TEXTO)
            y += 46
    return img

def cartao_encerramento():
    img = Image.new("RGB", (L, A), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, L, 12], fill=ACCENT)
    centralizado(d, 285, "Obrigado!", 84, ACCENT)
    centralizado(d, 435, "Ferramenta pública, gratuita e sem cadastro", 36, TEXTO, False)
    centralizado(d, 495, "para acompanhar as queimadas em todo o Brasil", 36, TEXTO, False)
    d.line([(L/2 - 90, 600), (L/2 + 90, 600)], fill=ACCENT, width=5)
    centralizado(d, 682, "UNIVESP  ·  Projeto Integrador  ·  Computação", 28, MUTED, False)
    centralizado(d, 757, "PJI410-DRP10  ·  2026", 36, ACCENT)
    return img

cartoes = {
    "01-abertura": cartao_abertura(),
    "02-objetivo": cartao_secao("Objetivo", "Site público com mapa interativo e dashboard, a partir dos dados abertos do INPE",
        ["Mapa interativo com focos de calor georreferenciados",
         "Dashboard com incidência por estado, bioma e satélite",
         "Acesso livre, sem cadastro, para gestores e cidadãos"]),
    "03-metodologia": cartao_secao("Metodologia", "Design Thinking: imersão, prototipagem e testes iterativos",
        ["Entrevista com a Defesa Civil de Matão (Luciano Gonçalves Leite)",
         "Análise documental dos dados abertos do INPE",
         "Ciclos de protótipo avaliados e ajustados com o usuário"]),
    "04-stack": cartao_secao("Stack utilizada", "Aplicação frontend com consumo direto de dados abertos",
        ["Vue.js + TypeScript + HTML5 + CSS", "Leaflet (mapa) e Chart.js (gráficos)",
         "Fetch API, cache local e fallback", "GitHub + GitHub Actions (CI) + Vercel (deploy)"]),
    "05-resultado": cartao_secao("Resultado final", "Mapa coroplético, dashboard em abas e histórico de 1998 a 2025",
        ["Dashboard em três abas: Hoje, Gráficos e Histórico",
         "Histórico com quase 59 milhões de focos agregados",
         "Filtros por dia, estado, cidade, bioma e satélite",
         "Exportação do recorte em CSV"]),
    "06-encerramento": cartao_encerramento(),
}

for nome, img in cartoes.items():
    img.save(f".video/cards/{nome}.png")
    img.convert("RGB").save(f".video/cards/{nome}.jpg", "JPEG", quality=95)
    print("cartão:", nome, img.size)
