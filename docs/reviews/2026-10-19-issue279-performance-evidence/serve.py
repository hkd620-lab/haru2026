from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import sys

site, output = Path(sys.argv[1]), Path(sys.argv[2])
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(site), **kwargs)
    def do_POST(self):
        if self.path != '/results':
            self.send_error(404)
            return
        data = self.rfile.read(int(self.headers['Content-Length']))
        value = json.loads(data)
        output.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        self.send_response(200)
        self.end_headers()
ThreadingHTTPServer(('127.0.0.1', 18779), Handler).serve_forever()
