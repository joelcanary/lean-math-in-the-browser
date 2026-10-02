"""Static server for the repository root with the MIME types a module Worker needs
(Python's http.server may serve .mjs as text/plain, which browsers refuse to run as a module).

Run: python bench/servir.py [port] [--aislado]   (default port 8125)

--aislado (for the call-cost bench in browsers, bench/navegador/llamada.html):
  * sends COOP/COEP so the page is cross-origin isolated, which is what gives performance.now()
    its finest resolution in every browser (without it the clock is coarsened);
  * accepts POST /resultado?nombre=<name> and writes the body to bench/out/<name>.json, so a page
    that runs on its own can hand its result back without a browser driver.
Only ever binds to 127.0.0.1.
"""
import http.server
import json
import mimetypes
import os
import re
import sys
import urllib.parse

mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/wasm", ".wasm")
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AISLADO = "--aislado" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]


class Manejador(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if AISLADO:
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        nombre = urllib.parse.parse_qs(u.query).get("nombre", [""])[0]
        if not AISLADO or u.path != "/resultado" or not re.fullmatch(r"[a-z0-9-]{1,60}", nombre):
            self.send_error(404)
            return
        cuerpo = self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 20_000_000))
        json.loads(cuerpo)                                  # refuse anything that is not JSON
        os.makedirs("bench/out", exist_ok=True)
        with open(f"bench/out/{nombre}.json", "wb") as h:
            h.write(cuerpo)
        self.send_response(204)
        self.end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", int(args[0]) if args else 8125), Manejador).serve_forever()
