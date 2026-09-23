import "./lib/env";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "5050";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, `DocQuiz API Server listening on http://localhost:${port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error({ port }, `Port ${port} is in use. Set PORT=<other_port> or free the port.`);
  } else {
    logger.error({ err }, "Server error");
  }
  process.exit(1);
});
