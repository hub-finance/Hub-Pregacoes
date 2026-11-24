"""Monta exemplo-mensagem.html: o modelo de mensagem por tópicos com o
conteúdo neutro de conteudo-exemplo.json (textos da Almeida 1911, domínio
público). Uso: python3 montar-exemplo.py <modelo.html>"""
import json, re, sys, pathlib
aqui = pathlib.Path(__file__).parent
modelo = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
dados = json.loads((aqui / 'conteudo-exemplo.json').read_text(encoding='utf-8'))
m = re.search(r'(<script[^>]*id="mensagem"[^>]*>)(.*?)(</script>)', modelo, re.S)
html = modelo[:m.start(2)] + json.dumps(dados, ensure_ascii=False) + modelo[m.end(2):]
html = re.sub(r'<title>.*?</title>', f"<title>{dados['titulo']}</title>", html, count=1)
html = html.replace('o gerador do Hub Pregações só precisa trocar esse bloco', 'para outra mensagem, basta trocar esse bloco')
(aqui / 'exemplo-mensagem.html').write_text(html, encoding='utf-8')
print('ok')
