#!/bin/sh
# Start a local HTTP server in the design/ folder.
#
# Why: many HTML files load JSX via <script type="text/babel" src="*.jsx">,
# which Babel-standalone has to fetch over HTTP. Double-clicking the file
# (file://) hits CORS and silently fails to render the page.
#
# Usage: ./serve.sh [port]   (default port 8000)
#
PORT=${1:-8000}
cd "$(dirname "$0")"
echo "Serving design/ at http://localhost:$PORT"
echo "  Launcher:  http://localhost:$PORT/index.html"
echo "  Press Ctrl-C to stop."
python3 -m http.server "$PORT"
