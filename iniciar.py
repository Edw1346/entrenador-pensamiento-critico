#!/usr/bin/env python3
"""Sirve la compilación local sin instalar dependencias de JavaScript."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent / 'dist'
if not (root / 'index.html').exists():
    raise SystemExit('Falta dist. Descarga la entrega completa o ejecuta npm install y npm run build.')
try:
    server = ThreadingHTTPServer(('127.0.0.1', 5186), partial(SimpleHTTPRequestHandler, directory=str(root)))
except OSError:
    raise SystemExit('El puerto 5186 está ocupado. Cierra otra instancia de Criterio y vuelve a intentarlo.')
print('Criterio está disponible en http://127.0.0.1:5186 — Ctrl+C para detener.')
webbrowser.open('http://127.0.0.1:5186')
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
