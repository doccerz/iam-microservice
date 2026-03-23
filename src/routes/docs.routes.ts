import { Router } from "express";
import path from "path";
import express from "express";

const { absolutePath } = require("swagger-ui-dist") as { absolutePath: () => string };

const router = Router();

router.get("/spec", (_req, res) => {
  res.type("yaml");
  res.sendFile(path.join(__dirname, "../docs/openapi.yaml"));
});

router.get("/", (_req, res) => {
  res.redirect("/docs/index.html?url=/docs/spec");
});

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

router.use(express.static(absolutePath()));

export default router;
