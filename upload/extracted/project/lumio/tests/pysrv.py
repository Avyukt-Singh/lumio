import json,http.server
class H(http.server.BaseHTTPRequestHandler):
    def _c(self):
        self.send_header('Access-Control-Allow-Origin','*')
    def do_OPTIONS(self):
        self.send_response(204);self._c();self.send_header('Access-Control-Allow-Headers','*');self.end_headers()
    def do_POST(self):
        d=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        ns={};exec(d['h'],ns)
        out=ns['_lumio'](d['code'],d['fn'],d['tests'])
        self.send_response(200);self._c();self.end_headers();self.wfile.write(out.encode())
    def log_message(self,*a):pass
http.server.ThreadingHTTPServer(('127.0.0.1',3199),H).serve_forever()
