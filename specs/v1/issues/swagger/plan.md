# Swagger UI Showing Petstore Instead of Project API

## Problem

Navigating to `/docs/` displayed the Swagger Petstore example API instead of the IAM Microservice API. Two root causes were found:

1. **`swagger-ui-dist` petstore override** — The package ships with `swagger-initializer.js` hardcoded to `https://petstore.swagger.io/v2/swagger.json`. The `?url=` query param passed in the redirect (`/docs/index.html?url=/docs/spec`) does not override this because the initializer's `window.onload` runs after the HTML loads and ignores the query param.

2. **`openapi.yaml` not in Docker image** — `tsc` only emits `.ts` files. The `src/docs/openapi.yaml` asset was never copied to `dist/`, so `GET /docs/spec` returned a 500 (file not found) when running in Docker.

## Fixes

### Fix 1 — Custom `swagger-initializer.js` route

Added a `GET /swagger-initializer.js` route in `src/routes/docs.routes.ts` **before** the `express.static(absolutePath())` middleware. Express matches routes top-to-bottom, so this handler intercepts the request before the dist version is served.

```ts
router.get("/swagger-initializer.js", (_req, res) => {
  res.type("application/javascript");
  res.send(
    `window.onload = function() {
  window.ui = SwaggerUIBundle({
    url: "/docs/spec",
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout"
  });
};`,
  );
});
```

### Fix 2 — Copy `openapi.yaml` to `dist/` in Dockerfile

Added `cp -r src/docs dist/docs` after `npm run build` in the builder stage so the YAML asset lands in `dist/docs/` and is picked up by the runtime stage's `COPY --from=builder /app/dist ./dist`.

```dockerfile
RUN npm run build && cp -r src/docs dist/docs
```

## Files Changed

| File | Change |
|------|--------|
| `src/routes/docs.routes.ts` | Added custom `GET /swagger-initializer.js` route before static middleware |
| `src/routes/__tests__/docs.routes.test.ts` | Added tests for new route; added `send` to `makeReqRes()` mock |
| `Dockerfile` | Copy `src/docs` to `dist/docs` after build |
| `.claude/rules/coding-patterns.md` | Documented `swagger-ui-dist` petstore gotcha |
| `.claude/rules/testing-patterns.md` | Added `send` to `mockRes()` helper pattern |
| `.claude/rules/project-overview.md` | Noted that non-TS assets must be manually copied in Dockerfile |

## PR

[#25 — fix: Swagger UI shows project API instead of Petstore](https://github.com/doccerz/user-microservice-js/pull/25)
