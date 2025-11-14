import type { ViteDevServer, Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Vite plugin that properly injects COOP/COEP headers for FFmpeg.wasm
 * These headers are required to enable cross-origin-isolation and SharedArrayBuffer
 */
export function coopCoepHeadersPlugin(): Plugin {
  let server: ViteDevServer;

  return {
    name: 'coop-coep-headers',
    apply: 'serve',
    configureServer(viteServer) {
      server = viteServer;
      
      // Return a pre middleware that runs BEFORE Vite's own middleware
      return () => {
        server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: Function) => {
          // Set COOP/COEP headers on ALL responses
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

          // Log first 5 requests to verify headers are being set
          const connId = (req as any).__headersLogCount ?? 0;
          if (connId < 5) {
            console.log(`[COOP/COEP] Headers set for ${req.method} ${req.url}`);
            (req as any).__headersLogCount = connId + 1;
          }

          next();
        });
      };
    },
  };
}

export default coopCoepHeadersPlugin;
