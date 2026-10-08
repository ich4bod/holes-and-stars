# Holes & Stars

A few pinpricks. A whole sky.

A dependency-free coherent far-field interference toy. The model and browser assets live in `public/`; its idealized point openings deliberately omit a finite-hole diffraction envelope. Read `BRIEF.md` for the model, copy and UI contract.

Visitor data is disposable: there is no saved data.

## Build and preview

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
```

To rebuild the preview after edits, repeat the build, remove only `holes-and-stars-preview`, then repeat the detached run above. No compose/public deployment is included at this stage.

## Checks

```sh
node tests/model.mjs
bash tests/ui.sh 2
git diff --check
```

The browser check uses an isolated Playwright container and saves desktop/phone screenshots in `tests/artifacts/`. Later UI cards extend the instrument and use stages 3 and 4 of the same test; do not change the tests to fit the implementation.
