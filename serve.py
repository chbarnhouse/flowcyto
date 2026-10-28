#!/usr/bin/env python3
"""Static file server for the homelab copy: python's http.server, plus Cache-Control: no-cache.

Without that header Safari guesses how long a page stays fresh and keeps showing an old index.html
(which loads the old ?v= scripts). no-cache makes it ask every time; unchanged files come back as a
cheap 304. Usage: serve.py PORT DIRECTORY
"""
import functools, http.server, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

port, root = int(sys.argv[1]), sys.argv[2]
http.server.ThreadingHTTPServer(('0.0.0.0', port), functools.partial(Handler, directory=root)).serve_forever()
