# Holes & Stars

A few pinpricks. A whole sky.

A dependency-free coherent far-field interference toy. Open an already rendered sky, choose Pair, Triangle or Ring, add/drag/remove 1–8 point openings, or edit the selected opening with keyboard sliders. Touch the sky or use the screen-coordinate sliders to inspect a spot: individual wave arrows join end to end beside their resultant and normalized brightness. Move the entire mask in .1 steps: the arrows turn together, but the sky's intensity pattern stays put. Illegal group moves are rejected atomically without changing the selection or inspection point.

Desktop puts the mask beside the larger sky. On phones the sky comes first, then mask/edit controls, then inspection. Optional model notes and the source link are folded by default. There is no animation or audio, and reduced motion leaves the instrument unchanged.

Visitor data is disposable: there is no saved data. There is no persistence, account, analytics, or runtime network dependency.

## Model and approximations

The engine and browser assets live in `public/`. `BRIEF.md` contains the exact model, visitor copy, and DOM/test contract.

This is an idealized far-field model of one color of perfectly coherent light and equally strong point openings, using dimensionless source and screen coordinates. Each wave has phase `-2*pi*(u*x + v*y)`. Intensity is the squared length of their complex sum divided by `N²`, not a comparison of absolute transmitted power between different hole counts. Real openings have width and a diffraction envelope; the toy deliberately omits that envelope. The displayed 256×256 intensity texture uses a square-root brightness curve, scaled smoothly without decorative stars or overlays painted into its pixels.

Translation adds a common phase to every arriving wave, changing the complex sum's direction, not its length. Source edits recompute the real raster through a coalesced render scheduler; the translation effect is not a frozen canvas. Source coordinates are bounded to [-1,1], screen coordinates to [-6,6], and individual edits reject holes closer than .08 units. Edit rounding avoids false boundary failures from repeated .1 moves.

## Build and detached preview

From this checkout:

```sh
docker build -t holes-and-stars:preview .
docker run -d --name holes-and-stars-preview \
  --network ichabod-proxy --cpus=0.50 --memory=512m --pids-limit=256 \
  --restart unless-stopped \
  --log-opt max-size=10m --log-opt max-file=3 \
  holes-and-stars:preview
```

The detached preview serves `http://holes-and-stars-preview:3000` on the Docker network. It has no published host port, Traefik routing labels or public hostname route. `/healthz` returns `ok`. Both `.js` and `.mjs` are served as JavaScript. Before testing, wait for the healthcheck or confirm HTTP readiness with:

```sh
docker exec holes-and-stars-preview wget -qO- http://127.0.0.1:3000/healthz
docker inspect holes-and-stars-preview --format '{{.State.Health.Status}}'
```

To rebuild after edits, repeat the build, remove only `holes-and-stars-preview` with `docker rm -f holes-and-stars-preview`, then repeat the detached run above. The image uses `nginx:1.27-alpine` and serves static files on port 3000; it needs no volume.

## Public deployment

Live URL: https://holes-and-stars.ichabod-crane.net

```sh
docker compose up -d --build
verify-app holes-and-stars
bash tests/ui.sh 4 https://holes-and-stars.ichabod-crane.net
```

Compose uses the external `ichabod-proxy` network and Traefik's `web` entrypoint with no published host port. Limits are 0.50 CPU, 512 MB memory, and 256 PIDs; the healthcheck fetches `/healthz` on port 3000. Source, styles and module import URLs are versioned. After both public instrument and creations-list checks pass, remove only the detached preview with `docker rm -f holes-and-stars-preview`.

## Local checks

Node runs the engine tests without installing packages. Docker provides the isolated Playwright browser for UI tests:

```sh
node tests/model.mjs
bash tests/ui.sh 4
git diff --check && echo 'diff clean'
```

Expected stdout: `model pass`, `ui 4 pass`, and `diff clean`. Browser package-install diagnostics go to stderr. The UI check saves desktop (1280×900) and phone (390×844) full-page screenshots in ignored `tests/artifacts/`. Stage 4 covers the complete instrument, including wave inspection and group translation; stages 2 and 3 remain earlier-stage checks. An optional second argument to `tests/ui.sh` selects another test URL. Do not edit acceptance scripts to fit the implementation.
