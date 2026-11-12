# -*- coding: utf-8 -*-
"""Expande a timeline em uma sequência uniforme de frames (12 fps) e
codifica o MP4 sem depender do demuxer concat (que descarta blocos de
imagem isolados)."""
import json, os, shutil, subprocess
from pathlib import Path

RAIZ = Path(".video")
FPS = 12
TIMELINE = [
    ("card", "01-abertura", 20.0),
    ("seg", "s1-mapa", 35.0),
    ("card", "02-objetivo", 3.5),
    ("seg", "s2-filtros", 31.5),
    ("card", "03-metodologia", 3.5),
    ("seg", "s3-dashboard", 41.5),
    ("card", "04-stack", 3.5),
    ("seg", "s4-graficos", 31.5),
    ("card", "05-resultado", 3.5),
    ("seg", "s5-historico", 51.5),
    ("seg", "s6-final", 55.0),
    ("card", "06-encerramento", 20.0),
]

# 1) pré-carrega os blocos: para cada um, lista (tempo_relativo, arquivo)
blocos = []
inicio = 0.0
for tipo, nome, duracao in TIMELINE:
    if tipo == "card":
        blocos.append({"inicio": inicio, "fim": inicio + duracao, "card": (RAIZ / "cards" / f"{nome}.jpg").resolve(), "frames": None})
    else:
        base = RAIZ / "seg" / nome
        manifest = json.loads((base / "manifest.json").read_text())
        frames = sorted((base / "frames").glob("*.jpg"))
        pares = list(zip(manifest["timestamps"], frames))
        blocos.append({"inicio": inicio, "fim": inicio + duracao, "card": None, "frames": pares})
    inicio += duracao

TOTAL = inicio
print(f"timeline: {TOTAL:.2f}s")

# 2) gera a sequência de saída
saida = RAIZ / "sequencia"
shutil.rmtree(saida, ignore_errors=True)
saida.mkdir(parents=True)
total_frames = int(round(TOTAL * FPS))
contador = 0
for i in range(total_frames):
    t = i / FPS
    bloco = next(b for b in blocos if b["inicio"] <= t < b["fim"] or (b is blocos[-1] and t >= b["inicio"]))
    if bloco["card"]:
        origem = bloco["card"]
    else:
        rel = t - bloco["inicio"]
        pares = bloco["frames"]
        # último frame cujo timestamp <= rel
        escolhido = pares[0][1]
        for ts, caminho in pares:
            if ts <= rel:
                escolhido = caminho
            else:
                break
        origem = escolhido
    contador += 1
    destino = saida / f"{contador:06d}.jpg"
    os.link(origem, destino)  # hard link: não duplica bytes

print(f"frames na sequência: {contador} ({contador / FPS:.1f}s a {FPS} fps)")

# 3) codifica
comando = [
    "ffmpeg", "-y", "-loglevel", "error",
    "-framerate", str(FPS), "-i", str(saida / "%06d.jpg"),
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "22",
    "-r", "30", "-movflags", "+faststart",
    "docs/video/apresentacao-pi-grupo20.mp4",
]
print("codificando…")
subprocess.run(comando, check=True)
print("pronto")
