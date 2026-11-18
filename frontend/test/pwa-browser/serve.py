"""Serve a disposable built fixture, changing only the worker response to simulate a deployment."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=18774)
args=parser.parse_args()
root=Path(__file__).resolve().parent/'dist'
class Handler(SimpleHTTPRequestHandler):
    version=1
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
    def do_POST(self):
        if self.path!='/qa-next':self.send_error(404);return
        Handler.version+=1
        data=str(Handler.version).encode()
        self.send_response(200);self.end_headers();self.wfile.write(data)
    def do_GET(self):
        if self.path.split('?')[0]=='/sw.js':
            data=(root/'sw.js').read_bytes()+f'\n// fixture version {Handler.version}\n'.encode()
            self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data);return
        super().do_GET()
    def log_message(self,*args):pass
print(f'PWA fixture http://127.0.0.1:{args.port}',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
