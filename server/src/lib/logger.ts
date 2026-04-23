import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      'req.headers["x-app-market-key"]',
      'req.headers["x-sync-signature"]',
      "res.headers.authorization",
    ],
    remove: false,
    censor: "[Redacted]",
  },
});
