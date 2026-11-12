#!/usr/bin/env python3
"""Gera os dados históricos agregados do site a partir das fontes oficiais do INPE.

Fontes:
- Anual:   {BASE}/anual/Brasil_todos_sats/focos_br_todos-sats_<ano>.zip (1998–2025)
- Mensal:  {BASE}/mensal/Brasil/focos_mensal_br_<aaaamm>.csv          (2023-01 …)

Baixa cada arquivo uma única vez para um cache local (não versionado),
agrega contagens (total, por estado e por bioma) de forma incremental e
escreve public/dados/historico-anual.json e public/dados/historico-mensal.json.

Uso:
    python3 scripts/gerar-historico.py            # tudo (anual + mensal)
    python3 scripts/gerar-historico.py mensal     # só mensal
    python3 scripts/gerar-historico.py anual      # só anual

O script é retomável: arquivos já agregados ficam registrados em
.cache-historico/progresso.json e não são baixados de novo.
"""

import csv
import io
import json
import sys
import time
import zipfile
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv"
RAIZ = Path(__file__).resolve().parent.parent
CACHE = RAIZ / ".cache-historico"
SAIDA = RAIZ / "public" / "dados"
PROGRESSO = CACHE / "progresso.json"

ANOS = range(1998, 2026)
MESES = [
    f"{ano}{mes:02d}"
    for ano in range(2023, 2027)
    for mes in range(1, 13)
    if not (ano == 2026 and mes > 11)
]

FONTES = {
    "anual": {
        "arquivo": "historico-anual.json",
        "url_zip": lambda ano: (
            f"{BASE}/anual/Brasil_todos_sats/"
            f"focos_br_todos-sats_{ano}.zip"
        ),
        "chave": lambda ano: f"anual-{ano}",
        "rotulo": lambda ano: {"ano": ano},
    },
    "mensal": {
        "arquivo": "historico-mensal.json",
        "url_csv": lambda chave: (
            f"{BASE}/mensal/Brasil/focos_mensal_br_{chave}.csv"
        ),
        "url_zip": lambda chave: (
            f"{BASE}/mensal/Brasil/focos_mensal_br_{chave}.zip"
        ),
        "chave": lambda chave: f"mensal-{chave}",
        "rotulo": lambda chave: {"mes": f"{chave[:4]}-{chave[4:]}"},
    },
}


def carregar_progresso():
    if PROGRESSO.exists():
        return json.loads(PROGRESSO.read_text(encoding="utf-8"))
    return {}


def salvar_progresso(progresso):
    CACHE.mkdir(parents=True, exist_ok=True)
    PROGRESSO.write_text(
        json.dumps(progresso, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )


def baixar(url: str, destino: Path) -> Path:
    """Baixa com retomada: cache local + arquivo .part durante o fluxo."""
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".part")
    ultimo_erro = None
    for tentativa in range(1, 4):
        try:
            requisicao = Request(
                url, headers={"User-Agent": "monitor-queimadas-br/1.0"}
            )
            with urlopen(requisicao, timeout=180) as resposta, open(
                parcial, "wb"
            ) as local:
                while True:
                    bloco = resposta.read(1 << 20)
                    if not bloco:
                        break
                    local.write(bloco)
            parcial.rename(destino)
            return destino
        except HTTPError as erro:
            # 404 não melhora com nova tentativa: falha imediata.
            ultimo_erro = erro
            if erro.code in (404, 410):
                break
            print(f"  tentativa {tentativa} falhou: {erro}", flush=True)
            time.sleep(5 * tentativa)
        except Exception as erro:  # noqa: BLE001 - registrado e repetido
            ultimo_erro = erro
            parcial.unlink(missing_ok=True)
            print(f"  tentativa {tentativa} falhou: {erro}", flush=True)
            time.sleep(5 * tentativa)
    raise RuntimeError(f"Download falhou: {url}") from ultimo_erro


def linhas_csv(caminho: Path):
    """Itera linhas do CSV (zip ou cruza) sem carregar tudo na memória."""
    if caminho.suffix == ".zip":
        with zipfile.ZipFile(caminho) as zipado:
            membro = next(
                n for n in zipado.namelist() if n.lower().endswith(".csv")
            )
            with zipado.open(membro) as bruto:
                yield from _linhas_brutas(io.TextIOWrapper(
                    bruto, encoding="utf-8-sig", errors="replace"
                ))
    else:
        with open(caminho, encoding="utf-8-sig", errors="replace") as bruto:
            yield from _linhas_brutas(bruto)


def _linhas_brutas(texto):
    leitor = csv.reader(texto)
    cabecalho = None
    for valores in leitor:
        valores = [v.strip() for v in valores]
        if cabecalho is None:
            cabecalho = [v.lower().strip('"') for v in valores]
            continue
        if len(valores) != len(cabecalho) or not any(valores):
            continue
        yield dict(zip(cabecalho, valores))


def agregar(caminho: Path) -> dict:
    """Agrega contagens e FRP (médio/máximo) por período.

    Formato compacto no JSON final:
    - municipios[ESTADO][MUNICIPIO] = [contagem, frp_medio, frp_max]
      (frp_medio/frp_max = null quando nenhum foco tem FRP no período)
    - frp_estados[ESTADO] = [contagem, frp_medio, frp_max]
    """
    total = 0
    estados: dict = {}
    biomas: dict = {}
    municipios: dict = {}
    frp_mun: dict = {}
    frp_est: dict = {}

    for linha in linhas_csv(caminho):
        total += 1
        estado = (linha.get("estado") or "").strip().upper() or "—"
        bioma = (linha.get("bioma") or "").strip() or "—"
        municipio = (linha.get("municipio") or "").strip().upper() or "—"
        estados[estado] = estados.get(estado, 0) + 1
        biomas[bioma] = biomas.get(bioma, 0) + 1
        por_estado = municipios.setdefault(estado, {})
        por_estado[municipio] = por_estado.get(municipio, 0) + 1

        bruto = (linha.get("frp") or "").strip()
        try:
            frp = float(bruto) if bruto else None
        except ValueError:
            frp = None
        if frp is not None:
            acum = frp_mun.setdefault(estado, {}).setdefault(
                municipio, [0.0, 0, 0.0]
            )
            acum[0] += frp
            acum[1] += 1
            if frp > acum[2]:
                acum[2] = frp
            tot = frp_est.setdefault(estado, [0.0, 0, 0.0])
            tot[0] += frp
            tot[1] += 1
            if frp > tot[2]:
                tot[2] = frp

    def frp_medio_max(acumulado):
        soma, cont, maximo = acumulado
        medio = round(soma / cont, 1) if cont else None
        return [medio, round(maximo, 1)]

    municipios_final = {
        estado: {
            municipio: [
                contagem,
                *(
                    frp_medio_max(
                        frp_mun[estado][municipio]
                    )
                    if municipio in frp_mun.get(estado, {})
                    else [None, None]
                ),
            ]
            for municipio, contagem in por_estado.items()
        }
        for estado, por_estado in municipios.items()
    }

    return {
        "total": total,
        "estados": estados,
        "biomas": biomas,
        "municipios": municipios_final,
        # Mesmo contrato de municipios: [contagem, frp_medio, frp_max].
        "frp_estados": {
            e: [
                estados.get(e, 0),
                *frp_medio_max(a),
            ]
            for e, a in frp_est.items()
        },
    }


def processar(fonte: str, chaves: list, nome_arquivo):
    progresso = carregar_progresso()
    registros = []
    for indice, chave in enumerate(chaves, 1):
        identificador = FONTES[fonte]["chave"](chave)
        if identificador in progresso:
            print(f"[{fonte}] {identificador} já agregado — pulando", flush=True)
            registros.append({**FONTES[fonte]["rotulo"](chave), **progresso[identificador]})
            continue
        # Alguns períodos existem como .csv e outros como .zip no servidor.
        candidatos = (
            [(".zip", FONTES[fonte]["url_zip"](chave))]
            if fonte == "anual"
            else [(".csv", FONTES[fonte]["url_csv"](chave)), (".zip", FONTES[fonte]["url_zip"](chave))]
        )
        local = None
        ultimo_erro = None
        for extensao, url in candidatos:
            tentativa_local = CACHE / f"{identificador}{extensao}"
            try:
                print(f"[{fonte}] ({indice}/{len(chaves)}) baixando {url}", flush=True)
                inicio = time.monotonic()
                baixar(url, tentativa_local)
                local = tentativa_local
                break
            except RuntimeError as erro:
                ultimo_erro = erro
                print(f"  {extensao} indisponível para {identificador}", flush=True)
        if local is None:
            raise ultimo_erro
        agregado = agregar(local)
        duracao = time.monotonic() - inicio
        print(
            f"[{fonte}] {identificador}: {agregado['total']:,} focos "
            f"em {duracao:.0f}s",
            flush=True,
        )
        progresso[identificador] = agregado
        salvar_progresso(progresso)
        registros.append({**FONTES[fonte]["rotulo"](chave), **agregado})
    # Ordena por rótulo natural (ano ou mes) e grava o JSON final.
    registros.sort(key=lambda r: r.get("ano", r.get("mes", 0)))
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / nome_arquivo
    documento = {
        "fonte": f"{BASE}/{'anual/Brasil_todos_sats' if fonte == 'anual' else 'mensal/Brasil'}",
        "geradoEm": time.strftime("%Y-%m-%d %H:%M:%S %z"),
        "formato": "focos agregados (total, estados, biomas) por período",
        "registros": registros,
    }
    destino.write_text(
        json.dumps(documento, ensure_ascii=False, sort_keys=False),
        encoding="utf-8",
    )
    print(f"[{fonte}] gravado {destino} ({len(registros)} períodos)", flush=True)


def main():
    escolha = sys.argv[1] if len(sys.argv) > 1 else "tudo"
    alvos = (
        ["anual", "mensal"] if escolha == "tudo" else [escolha]
    )
    for fonte in alvos:
        if fonte not in FONTES:
            raise SystemExit(f"fonte desconhecida: {fonte}")
        processar(
            fonte,
            list(ANOS) if fonte == "anual" else list(MESES),
            FONTES[fonte]["arquivo"],
        )


if __name__ == "__main__":
    main()
