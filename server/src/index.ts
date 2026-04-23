import express from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { assertSyncSecurityEnv, env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { oauthRouter } from "./routes/oauth.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { connectionRouter } from "./routes/connection.js";
import { mappingsRouter } from "./routes/mappings.js";
import { formsRouter } from "./routes/forms.js";
import { startSyncWorker } from "./services/sync-job-queue.js";

assertSyncSecurityEnv();

const app = express();

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (
      origin.includes(".wix.com") ||
      origin.includes(".wixsite.com") ||
      origin.includes(".wixstudio.com") ||
      origin.includes(".wix-host.com") ||
      origin.includes(".wixapps.net") ||
      origin.includes("localhost")
    ) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "content-type",
    "authorization",
    "cache-control",
    "pragma",
    "x-wix-site-id",
    "x-app-market-key",
    "x-sync-signature",
  ],
  optionsSuccessStatus: 204,
};

app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
        };
      },
    },
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/oauth", oauthRouter);
app.use("/webhooks", webhooksRouter);
app.use("/dashboard", dashboardRouter);
app.use("/connection", connectionRouter);
app.use("/mappings", mappingsRouter);
app.use("/forms", formsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ error }, "Unhandled server error");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Wix-HubSpot backend server started");
});

startSyncWorker();
