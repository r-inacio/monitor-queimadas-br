# -*- coding: utf-8 -*-
"""Monta a parte: sequência de frames com crossfade + encode H.264 (sem áudio).
Uso: python3 docs/video/scripts/montar.py 01
"""
import json, os, re, shutil, subprocess, sys
from pathlib import Path
from PIL import Image

FPS = 10
FADE = 6          # frames de crossfade (~0,5 s)
RAIZ = Path(".")
numero = str(sys.argv[1]).zfill(2)
TRAB = RAIZ / ".video/partes" / numero
STORY = TRAB / "storyboard.json"
ROTEIRO = RAIZ / "docs/video/roteiro-19-partes.md"
PPM = 140

texto = ROTEIRO.read_text(encoding="utf-8")
secoes = re.split(r"^## Audio (\d+)$", texto, flags=re.M)
falas = {str(secoes[i]).zfill(2): secoes[i + 1].strip() for i in range(1, len(secoes), 2)}
_story = json.loads(STORY.read_text(encoding="utf-8"))
_texto_parte = falas.get(numero, "")
palavras = len(_texto_parte.split())
duracao = float(_story["duracao"]) if "duracao" in _story else round(palavras / PPM * 60 + 0.6, 2)

story = json.loads(STORY.read_text(encoding="utf-8"))
FADE = int(story.get("fade", 6))   # 0 = sem fade de entrada
blocos = []
soma = 0.0
for b in story["blocos"]:
    dur = round(duracao * b.get("fracao", 1.0), 3)
    blocos.append({**b, "duracao": dur})
    soma += dur
blocos[-1]["duracao"] = round(blocos[-1]["duracao"] + (duracao - soma), 3)

# plano: qual arquivo de origem cada frame usa
total = round(duracao * FPS)
plano, limites = [], []
inicio = 0.0
for i, b in enumerate(blocos):
    if b["tipo"] == "cartao":
        fontes = [RAIZ / ".video/cards" / f"{b['nome']}.jpg"]
    else:
        d = TRAB / "capturas" / f"bloco-{i}"
        fontes = sorted(list(d.glob("*.png")) + list(d.glob("*.jpg")))
        if not fontes:
            raise SystemExit(f"sem frames no bloco {i} — rode a captura antes")
    primeiro, ultimo = round(inicio * FPS), round((inicio + b["duracao"]) * FPS)
    limites.append((primeiro, len(plano)))
    for k in range(primeiro, min(ultimo, total)):
        rel = (k - primeiro) / max(1, ultimo - primeiro)
        plano.append(fontes[min(len(fontes) - 1, int(rel * len(fontes)))])
    inicio += b["duracao"]

seq = TRAB / "seq"
shutil.rmtree(seq, ignore_errors=True)
seq.mkdir(parents=True)
preto = Image.new("RGB", (1920, 1080), (16, 20, 15))

for k, origem in enumerate(plano):
    destino = seq / f"{k + 1:06d}.png"
    # fade de entrada do vídeo
    if k < FADE:
        with Image.open(origem) as img:
            Image.blend(preto, img.convert("RGB"), (k + 1) / FADE).save(destino, "PNG")
        continue
    # crossfade na entrada de cada bloco (menos o primeiro)
    fronteira = next((f for f, _ in limites if f > 0 and f <= k < f + FADE), None)
    if fronteira is not None:
        indice_bloco = [f for f, _ in limites].index(fronteira)
        anterior = plano[limites[indice_bloco][0] - 1]
        with Image.open(anterior) as a, Image.open(origem) as bimg:
            t = (k - fronteira + 1) / FADE
            Image.blend(a.convert("RGB"), bimg.convert("RGB"), t).save(destino, "PNG")
        continue
    if origem.suffix == ".png":
        os.link(origem, destino)
    else:
        # cartões são JPEG: converte para PNG de verdade (o nome já é .png)
        with Image.open(origem) as img:
            img.convert("RGB").save(destino, "PNG")

print(f"parte {numero}: {palavras} palavras → {duracao}s | {len(plano)} frames ({len(plano)/FPS:.2f}s) | fade {FADE} frames")

saida = RAIZ / ".video/preview" / f"parte-{numero}.mp4"
saida.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
    "-framerate", str(FPS), "-i", str(seq / "%06d.png"),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x10140f,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-r", "30",
    "-an", "-movflags", "+faststart", str(saida)], check=True)
print("preview:", saida)
