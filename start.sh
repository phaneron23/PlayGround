#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p bash -c 'PROJECT_DIR="$(pwd)"; echo "project: $PROJECT_DIR"'
/usr/bin/time -p bash -c 'echo "PORT=${PORT:-3000}"'
PORT="${PORT:-3000}"
export PORT
/usr/bin/time -p mkdir -p dist
/usr/bin/time -p bash -c 'if [ ! -f dist/index.html ]; then echo "generating dist/index.html"; fi'
if [ ! -f dist/index.html ]; then
cat > dist/index.html <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PlayGround — Browser Game Experiments</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; }
  main { max-width: 720px; padding: 48px 24px; text-align: center; }
  h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin: 0 0 12px; }
  p { opacity: 0.85; line-height: 1.6; }
  .card { margin-top: 24px; padding: 20px; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; background: rgba(255,255,255,0.05); text-align: left; }
  .row { display: flex; gap: 12px; margin-top: 20px; justify-content: center; flex-wrap: wrap; }
  a.btn { display: inline-block; padding: 10px 18px; border-radius: 999px; background: #38bdf8; color: #082f49; font-weight: 700; text-decoration: none; }
  a.ghost { display: inline-block; padding: 10px 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.3); color: inherit; text-decoration: none; }
  code { background: rgba(255,255,255,0.12); padding: 2px 6px; border-radius: 6px; }
</style>
</head>
<body>
<main>
<h1>PlayGround</h1>
<p>Playground for browser game experiments. Static preview is live.</p>
<div class="card">
<strong>Status</strong>
<p>Served from <code>dist/index.html</code> on <code>PORT</code>. Replace this placeholder with your game build.</p>
</div>
<div class="row">
<a class="btn" href="#">Start Game</a>
<a class="ghost" href="https://github.com/phaneron23/PlayGround">Source</a>
</div>
</main>
</body>
</html>
HTML
fi
/usr/bin/time -p bash -c 'if [ -f package.json ]; then echo "package.json found"; else echo "no package.json, skipping install/build"; fi'
if [ -f package.json ]; then
  /usr/bin/time -p npm install --no-audit --no-fund
  if /usr/bin/time -p bash -c 'node -e "const p=require(\"./package.json\"); process.exit(p.scripts && p.scripts.build ? 0 : 1)"'; then
    /usr/bin/time -p npm run build
  fi
fi
/usr/bin/time -p bash -c 'ls -l dist/index.html'
/usr/bin/time -p bash -c 'OUT_DIR="${OPENCODE_WEB_DIR:-$PWD/.opencode-web}"; mkdir -p "$OUT_DIR"; node -e "const fs=require(\"fs\"),path=require(\"path\"); const project=process.cwd(); const directory=path.resolve(project,\"dist\"); const out=path.join(process.env.OPENCODE_WEB_DIR || path.join(project,\".opencode-web\"),\"deployment-output.json\"); fs.mkdirSync(require(\"path\").dirname(out),{recursive:true}); fs.writeFileSync(out, JSON.stringify({project, directory})); console.log(out, JSON.stringify({project, directory}))"'
/usr/bin/time -p python3 --version
/usr/bin/time -p python3 -m http.server "$PORT" --directory dist --bind 0.0.0.0
