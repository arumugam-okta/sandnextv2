// Serves the self-built Sandpack bundler (codesandbox-client `www/`) on its own origin.
// Sandpack requires the bundler on a different origin from the host app: it evaluates user code.
//   BUNDLER_DIR  directory to serve   (default: .bundler/www)
//   BUNDLER_PORT port                 (default: 8090)
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.env.BUNDLER_DIR ?? ".bundler/www");
const port = Number(process.env.BUNDLER_PORT ?? 8090);

if (!existsSync(join(root, "index.html"))) {
  console.error(`No bundler found at ${root}. Run: npm run bundler:build`);
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  // unknown paths fall back to index.html (the bundler is routed by the iframe URL)
  if (!existsSync(file)) file = join(root, "index.html");

  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Sandpack bundler: http://localhost:${port}  (serving ${root})`));
