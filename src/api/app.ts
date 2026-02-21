import { Hono } from "hono";

import { createLogsRouter, type LogsRepository } from "./routes/logs";

export function createApp(deps: { logsRepository: LogsRepository }) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/api/logs", createLogsRouter(deps.logsRepository));

  return app;
}

