#!/bin/bash

# Alternative dev server that properly sends COOP/COEP headers
# This uses a simple Node.js server that sits in front of Vite

PORT=${1:-5174}

# Kill any existing servers on this port
kill $(lsof -t -i:$PORT) 2>/dev/null || true
sleep 1

# Start the wrapper server
node << 'EOF'
const http = require('http');
const { createServer: createViteServer } = require('vite');
const path = require('path');

const PORT = process.env.PORT || 5174;

async function start() {
  // Create Vite dev server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  // Create HTTP server with middleware wrapper
  const server = http.createServer((req, res) => {
    // Set COOP/COEP headers FIRST on all responses
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Handle static files and Vite
    vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end('Not Found');
    });
  });

  server.listen(PORT, () => {
    console.log(`
✅ Dev server running with COOP/COEP headers enabled
📍 Local: http://localhost:${PORT}/
⚡ Headers: COOP=same-origin, COEP=require-corp
✨ FFmpeg.wasm should now work!
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is in use!`);
      process.exit(1);
    }
    throw err;
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
EOF
