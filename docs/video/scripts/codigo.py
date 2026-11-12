# -*- coding: utf-8 -*-
"""Tela de código com destaque de sintaxe (tokenizador por regex, sem placeholders)."""
import html, json, re, sys
from pathlib import Path

SCRIPT_INICIO = open(__file__.replace('.py', '-inicio.html'), encoding='utf-8').read()

COR = {"comentario": "#6f7d68", "string": "#a8d97a", "palavra": "#c792ea",
       "numero": "#82aaff", "funcao": "#ffcb6b"}

PY_KW = ("def", "return", "for", "in", "if", "else", "elif", "try", "except", "None", "True",
         "False", "import", "from", "as", "with", "class", "lambda", "not", "and", "or", "is",
         "pass", "raise", "continue", "break", "while", "yield", "setdefault", "get")
JS_KW = ("const", "let", "var", "return", "if", "else", "function", "null", "true", "false",
         "await", "async", "new", "computed", "props", "from", "import", "export")

def montar_regex(lang):
    kw = PY_KW if lang == "py" else JS_KW
    partes = []
    if lang == "py":
        partes.append(("comentario", r"#.*$"))
    else:
        partes.append(("comentario", r"//.*$"))
    partes += [
        ("string", r'\"\"\"[\s\S]*?\"\"\"'),
        ("string", r'"[^"\n]*"'),
        ("string", r"'[^'\n]*'"),
        ("numero", r"\b\d+(?:\.\d+)?\b"),
        ("palavra", r"\b(?:" + "|".join(map(re.escape, kw)) + r")\b"),
        ("funcao", r"\b[A-Za-z_][\w]*(?=\()"),
    ]
    return re.compile("|".join(f"(?P<{n}{i}>{p})" for i, (n, p) in enumerate(partes)))

def destacar(linha, lang, dentro_docstring=False):
    """Devolve (html, ainda_dentro_docstring)."""
    regex = montar_regex(lang)
    saida, pos, resto_doc = [], 0, dentro_docstring
    # linha inteira dentro de docstring (conteúdo de """ ... """)
    if resto_doc:
        fim = linha.find('"""')
        if fim == -1:
            return f'<span style="color:{COR["string"]}">{html.escape(linha)}</span>', True
        saida.append(f'<span style="color:{COR["string"]}">{html.escape(linha[:fim + 3])}</span>')
        pos, resto_doc = fim + 3, False
    for m in regex.finditer(linha, pos):
        if m.start() < pos:
            continue
        saida.append(html.escape(linha[pos:m.start()]))
        tipo = m.lastgroup.rstrip("0123456789")
        trecho = html.escape(m.group(0))
        saida.append(f'<span style="color:{COR[tipo]}">{trecho}</span>')
        pos = m.end()
        # detecta docstring aberta e não fechada na mesma linha
        if tipo == "string" and m.group(0).startswith('"""') and not m.group(0).endswith('"""', 3):
            resto_doc = True
    saida.append(html.escape(linha[pos:]))
    if resto_doc:
        # reaplica cor de string ao que sobrou
        return "".join(saida), True
    return "".join(saida), False

def painel(b):
    linhas = Path(b["arquivo"]).read_text(encoding="utf-8").splitlines()[b["inicio"] - 1: b["fim"]]
    corpo, doc = [], False
    for i, linha in enumerate(linhas, start=b["inicio"]):
        realce, doc = destacar(linha, b["lang"], doc)
        corpo.append(f'<div class="linha"><span class="num">{i}</span><code>{realce}</code></div>')
    extra = f"animation-delay:{b['atraso']:.2f}s"
    classe = "painel"
    if b.get("sai") is not None:
        extra = (f"animation:entra .6s ease-out {b['atraso']:.2f}s forwards,"
                 f"sai .5s ease-in {b['sai']:.2f}s forwards")
        classe = "painel painel--sai"
    return f"""
  <section class="{classe}" style="{extra}">
    <header>
      <span class="ponto"></span>
      <span class="arquivo">{html.escape(b['arquivo'])}</span>
      <span class="faixa">{html.escape(b['titulo'])}</span>
    </header>
    <div class="codigo">
{''.join(corpo)}
    </div>
  </section>"""

def main():
    spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    blocos = "".join(painel(b) for b in spec["paineis"])
    tela = f"""<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:1920px; height:1080px; overflow:hidden; background:#0d110c; color:#e8efe4;
    font-family:'DejaVu Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }}
  .barra {{ position:absolute; top:0; left:0; width:1920px; height:10px; background:#f59e0b; }}
  .cabecalho {{ position:absolute; left:90px; top:52px; }}
  .cabecalho .titulo {{ font-size:44px; font-weight:bold; color:#f59e0b; }}
  .cabecalho .sub {{ font-size:24px; color:#9aa894; margin-top:8px; }}
  .painel {{ position:absolute; left:90px; top:168px; width:1740px; height:820px;
    background:#12170f; border:1px solid #2a3326; border-radius:14px; overflow:hidden;
    opacity:0; animation:entra .6s ease-out forwards; }}
  .painel header {{ display:flex; align-items:center; gap:14px; padding:16px 24px;
    background:#161c14; border-bottom:1px solid #2a3326; }}
  .ponto {{ width:14px; height:14px; border-radius:50%; background:#f59e0b; }}
  .arquivo {{ font-family:'DejaVu Sans Mono',monospace; font-size:22px; }}
  .faixa {{ margin-left:auto; font-size:19px; color:#10140f; background:#f59e0b;
    padding:5px 14px; border-radius:999px; font-weight:bold; }}
  .codigo {{ padding:20px 26px; font-family:'DejaVu Sans Mono',monospace; font-size:23px; line-height:1.5; }}
  .linha {{ display:flex; gap:22px; white-space:pre; }}
  .num {{ color:#4d5a48; min-width:52px; text-align:right; }}
  .painel--sai {{ animation: none; }}
  @keyframes entra {{ from {{ opacity:0; transform:translateY(14px); }} to {{ opacity:1; transform:none; }} }}
  @keyframes sai {{ from {{ opacity:1; transform:none; }} to {{ opacity:0; transform:translateY(-10px); }} }}
</style></head>
<body>
  <div class="barra"></div>
  <div class="cabecalho">
    <div class="titulo">{spec['titulo']}</div>
    <div class="sub">{spec['subtitulo']}</div>
  </div>
{blocos}</body></html>
</body></html>
"""
    saida = Path(".video/slides") / f"parte-{spec['numero']}.html"
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(tela.replace("</body>", SCRIPT_INICIO + "</body>"), encoding="utf-8")
    print("tela de código:", saida, "|", len(spec["paineis"]), "painéis")

main()
