# -*- coding: utf-8 -*-
"""Slide HTML animado em 1920x1080 (tópicos surgindo conforme a fala)."""
import json, sys
from pathlib import Path

SCRIPT_INICIO = open(__file__.replace('.py', '-inicio.html'), encoding='utf-8').read()


def slide_timeline(spec):
    titulo, subtitulo = spec["titulo"], spec.get("subtitulo", "")
    passos, duracao = spec["bullets"], spec["duracao"]
    nos, rotulos = [], []
    for i, b in enumerate(passos):
        topo = 200 + i * 110
        nos.append(
            f'      <div class="no" style="top:{topo}px;animation-delay:{b["inicio"]:.2f}s">{i + 1}</div>')
        rotulos.append(
            f'      <div class="rotulo" style="top:{topo + 12}px;animation-delay:{b["inicio"]:.2f}s">{b["texto"]}</div>')
    altura_linha = (len(passos) - 1) * 110
    inicio_linha = passos[0]["inicio"] if passos else 1.0
    duracao_linha = max(0.5, (passos[-1]["inicio"] if passos else 1.0) - inicio_linha + 0.4)

    html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:1920px; height:1080px; overflow:hidden; background:#10140f; color:#e8efe4;
    font-family:'DejaVu Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }}
  .barra {{ position:absolute; top:0; left:0; width:1920px; height:12px; background:#f59e0b; }}
  .texto {{ position:absolute; left:138px; top:270px; width:680px; display:flex; flex-direction:column; }}
  .acento {{ width:99px; height:7px; background:#f59e0b; margin-bottom:28px;
    animation:entra .6s .1s ease-out both; }}
  .titulo {{ font-size:78px; font-weight:bold; color:#f59e0b; line-height:1.05;
    animation:entra .7s .25s ease-out both; }}
  .subtitulo {{ margin-top:28px; font-size:30px; color:#9aa894; line-height:1.5;
    animation:entra .7s .9s ease-out both; }}
  .linha {{ position:absolute; left:869px; top:232px; width:4px; height:{altura_linha}px; background:#f59e0b;
    opacity:.5; transform-origin:top; animation:cresce {duracao_linha:.2f}s {inicio_linha:.2f}s linear forwards; }}
  .no {{ position:absolute; left:840px; width:62px; height:62px; border-radius:50%; background:#f59e0b;
    color:#10140f; font-weight:bold; font-size:30px; display:flex; align-items:center; justify-content:center;
    opacity:0; animation:aparece .45s ease-out forwards; }}
  .rotulo {{ position:absolute; left:934px; font-size:34px; line-height:1.2; opacity:0;
    animation:surgir .55s ease-out forwards; }}
  .progresso {{ position:absolute; left:0; bottom:0; height:6px; background:#f59e0b; opacity:.75;
    animation:enche {duracao:.2f}s linear forwards; }}
  @keyframes entra {{ from {{ opacity:0; transform:translateY(26px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes aparece {{ from {{ opacity:0; transform:scale(.5); }} to {{ opacity:1; transform:scale(1); }} }}
  @keyframes surgir {{ from {{ opacity:0; transform:translateX(-26px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes cresce {{ from {{ transform:scaleY(0); }} to {{ transform:scaleY(1); }} }}
  @keyframes enche {{ from {{ width:0; }} to {{ width:1920px; }} }}
</style></head>
<body>
  <div class="barra"></div>
  <div class="texto">
    <div class="acento"></div>
    <div class="titulo">{titulo}</div>
    <div class="subtitulo">{subtitulo}</div>
  </div>
  <div class="linha"></div>
{chr(10).join(nos)}
{chr(10).join(rotulos)}
  <div class="progresso"></div></body></html>
</body></html>
"""
    saida = Path(".video/slides") / f"parte-{spec['numero']}.html"
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(html.replace("</body>", SCRIPT_INICIO + "</body>"), encoding="utf-8")
    print("slide timeline:", saida, "|", len(passos), "passos")
    return


def slide_sigla(spec):
    """Layout horizontal: sigla, significado (inglês → tradução), unidade e frase encadeada."""
    sigla, ingles = spec["sigla"], spec["ingles"]
    traducao, duracao = spec["traducao"], spec["duracao"]
    troca = spec.get("troca", 4.0)
    unidade = spec.get("unidade", "")
    frase = spec.get("frase", {})
    ta, tb = frase.get("t_a", 5.0), frase.get("t_b", 6.6)

    html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:1920px; height:1080px; overflow:hidden; background:#10140f; color:#e8efe4;
    font-family:'DejaVu Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }}
  .barra {{ position:absolute; top:0; left:0; width:1920px; height:12px; background:#f59e0b; }}
  .acento {{ position:absolute; left:140px; top:250px; width:110px; height:8px; background:#f59e0b;
    animation:entra .6s .1s ease-out both; }}
  .sigla {{ position:absolute; left:132px; top:285px; font-size:190px; font-weight:bold;
    color:#f59e0b; line-height:1; letter-spacing:2px; animation:entra .7s .2s ease-out both; }}
  .significados {{ position:absolute; left:800px; top:300px; width:980px; }}
  .ingles, .traduzido {{ position:absolute; left:0; top:0; width:980px; font-size:62px; line-height:1.15; }}
  .ingles {{ opacity:0; animation:mostra .6s .8s ease-out forwards, esconde .5s {troca:.2f}s ease-in forwards; }}
  .traduzido {{ opacity:0; animation:mostra .6s {troca + 0.3:.2f}s ease-out forwards; }}
  .legenda-en {{ position:absolute; left:800px; top:258px; font-size:22px; color:#9aa894;
    letter-spacing:1px; text-transform:uppercase; opacity:0;
    animation:mostra .5s .7s ease-out forwards, esconde .4s {troca:.2f}s ease-in forwards; }}
  .legenda-pt {{ position:absolute; left:800px; top:258px; font-size:22px; color:#9aa894;
    letter-spacing:1px; text-transform:uppercase; opacity:0;
    animation:mostra .5s {troca + 0.2:.2f}s ease-out forwards; }}
  .unidade {{ position:absolute; left:800px; top:408px; font-size:30px; color:#9aa894;
    opacity:0; animation:mostra .8s {spec.get("unidade_t", 5.0):.2f}s ease-out forwards; }}
  .faixa {{ position:absolute; bottom:150px; left:50%; transform:translateX(-50%);
    display:flex; align-items:center; gap:26px; padding:0; background:none;
    border-radius:0; font-size:38px; width:max-content; }}
  .a {{ opacity:0; animation:surgir .8s {ta:.2f}s ease-out forwards; }}
  .sinal {{ position:relative; width:46px; height:46px; opacity:0;
    animation:surgir .5s {ta + 0.5:.2f}s ease-out forwards; }}
  .seta {{ position:absolute; inset:0; color:#f59e0b; font-size:44px; line-height:46px; text-align:center;
    animation:esconde .85s {tb:.2f}s ease-in forwards; }}
  .mais {{ position:absolute; inset:0; color:#f59e0b; font-size:44px; line-height:46px; text-align:center;
    opacity:0; animation:mostra .85s {tb:.2f}s ease-out forwards; }}
  .b {{ opacity:0; animation:surgir 1s {tb + 0.6:.2f}s ease-out forwards; }}
  .progresso {{ position:absolute; left:0; bottom:0; height:6px; background:#f59e0b; opacity:.75;
    animation:enche {duracao:.2f}s linear forwards; }}
  @keyframes entra {{ from {{ opacity:0; transform:translateY(24px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes mostra {{ from {{ opacity:0; }} to {{ opacity:1; }} }}
  @keyframes esconde {{ from {{ opacity:1; }} to {{ opacity:0; }} }}
  @keyframes surgir {{ from {{ opacity:0; transform:translateY(14px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes enche {{ from {{ width:0; }} to {{ width:1920px; }} }}
</style></head>
<body>
  <div class="barra"></div>
  <div class="acento"></div>
  <div class="sigla">{sigla}</div>
  <div class="legenda-en">em inglês</div>
  <div class="legenda-pt">em português</div>
  <div class="significados">
    <div class="ingles">{ingles}</div>
    <div class="traduzido">{traducao}</div>
  </div>
  <div class="unidade">{unidade}</div>
  <div class="faixa">
    <span class="a">{frase.get('a', '')}</span>
    <span class="sinal"><span class="seta">↑</span><span class="mais">+</span></span>
    <span class="b">{frase.get('b', '')}</span>
  </div>
  <div class="progresso"></div></body></html>
</body></html>
"""
    saida = Path(".video/slides") / f"parte-{spec['numero']}.html"
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(html.replace("</body>", SCRIPT_INICIO + "</body>"), encoding="utf-8")
    print("slide sigla:", saida)


spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if spec.get("layout") == "sigla":
    slide_sigla(spec)
    sys.exit(0)

if spec.get("layout") == "timeline":
    slide_timeline(spec)
    sys.exit(0)

titulo, subtitulo = spec["titulo"], spec.get("subtitulo", "")
bullets, duracao = spec["bullets"], spec["duracao"]

itens = "\n".join(
    f'      <li style="animation-delay:{b["inicio"]:.2f}s">{b["texto"]}</li>'
    for b in bullets
)

html = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    width:1920px; height:1080px; overflow:hidden;
    background:#10140f; color:#e8efe4;
    font-family:'DejaVu Sans',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;
  }}
  .barra {{ position:absolute; top:0; left:0; width:1920px; height:12px; background:#f59e0b; }}
  .texto {{ position:absolute; left:138px; top:270px; width:680px; display:flex; flex-direction:column; }}
  .acento {{ width:99px; height:7px; background:#f59e0b; margin-bottom:28px;
    animation:entra .6s .1s ease-out both; }}
  .titulo {{ font-size:78px; font-weight:bold; color:#f59e0b; line-height:1.05;
    animation:entra .7s .25s ease-out both; }}
  .subtitulo {{ margin-top:28px; font-size:30px; color:#9aa894; line-height:1.5;
    animation:entra .7s .9s ease-out both; }}
  .lista {{ position:absolute; left:840px; top:225px; width:960px; list-style:none; }}
  .lista li {{ position:relative; margin:0 0 51px 0; padding-left:51px;
    font-size:34px; line-height:1.45; opacity:0;
    animation:surgir .65s ease-out forwards; }}
  .lista li::before {{ content:''; position:absolute; left:0; top:18px;
    width:18px; height:18px; border-radius:50%; background:#f59e0b; }}
  .progresso {{ position:absolute; left:0; bottom:0; height:6px; background:#f59e0b; opacity:.75;
    animation:enche {duracao:.2f}s linear forwards; }}
  @keyframes entra {{ from {{ opacity:0; transform:translateY(26px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes surgir {{ from {{ opacity:0; transform:translateX(-30px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes enche {{ from {{ width:0; }} to {{ width:1920px; }} }}
</style></head>
<body>
  <div class="barra"></div>
  <div class="texto">
    <div class="acento"></div>
    <div class="titulo">{titulo}</div>
    <div class="subtitulo">{subtitulo}</div>
  </div>
  <ul class="lista">
{itens}
  </ul>
  <div class="progresso"></div></body></html>
</body></html>
"""
saida = Path(".video/slides") / f"parte-{spec['numero']}.html"
saida.parent.mkdir(parents=True, exist_ok=True)
saida.write_text(html.replace("</body>", SCRIPT_INICIO + "</body>"), encoding="utf-8")
print("slide 1080p:", saida, "|", len(bullets), "tópicos")
