#!/usr/bin/env bash
# Builds the Sandpack bundler from codesandbox-client (requires Node 16, so it runs in Docker)
# and copies the result to .bundler/www. Set CA_BUNDLE to a PEM file if your network re-signs TLS.
set -euo pipefail
SRC="${BUNDLER_SRC:-.bundler/src}"
OUT=".bundler/www"
mkdir -p .bundler
[ -d "$SRC" ] || git clone --depth 1 https://github.com/codesandbox/codesandbox-client "$SRC"

CA_ARGS=()
CA_ENV=()
if [ -n "${CA_BUNDLE:-}" ]; then
  CA_ARGS=(-v "$CA_BUNDLE:/certs/ca.pem:ro")
  CA_ENV=(-e NODE_EXTRA_CA_CERTS=/certs/ca.pem -e SSL_CERT_FILE=/certs/ca.pem)
fi

docker run --rm -v "$(cd "$SRC" && pwd):/app" "${CA_ARGS[@]}" -w /app "${CA_ENV[@]}" \
  -e SENTRYCLI_SKIP_DOWNLOAD=1 -e PUPPETEER_SKIP_DOWNLOAD=1 -e PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 -e NODE_OPTIONS=--max-old-space-size=6144 -e CI=true node:16 \
  bash -c "(sed -i \"s|deb.debian.org|archive.debian.org|g; s|security.debian.org|archive.debian.org|g; /buster-updates/d\" /etc/apt/sources.list \&\& apt-get -o Acquire::Check-Valid-Until=false update -qq \&\& apt-get install -y -qq zstd) >/dev/null \&\& ${CA_BUNDLE:+yarn config set cafile /certs/ca.pem && }yarn install --frozen-lockfile --network-timeout 600000 && yarn build:deps && yarn build:sandpack"

rm -rf "$OUT" && cp -R "$SRC/www" "$OUT"
echo "Bundler built at $OUT"
