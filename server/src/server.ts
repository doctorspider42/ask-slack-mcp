#!/usr/bin/env node
import "dotenv/config";
import http from "node:http";
import { createRequire } from "module";
import { sendQuestionAndWait, startBoltApp, stopBoltApp, SlackQuestionOption } from "./slack.js";
import { getServerPort, getServerApiKey } from "./config.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

const PORT = getServerPort();
const API_KEY = getServerApiKey();

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const httpServer = http.createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok", version: VERSION });
    return;
  }

  // Main endpoint
  if (req.method === "POST" && req.url === "/api/ask") {
    // Validate API key
    const providedKey =
      req.headers["x-api-key"] ??
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "");

    if (!providedKey || providedKey !== API_KEY) {
      sendJson(res, 401, { error: "Invalid or missing API key" });
      return;
    }

    try {
      const rawBody = await readBody(req);
      const body = JSON.parse(rawBody) as {
        question?: string;
        context?: string;
        slack_user_id?: string;
        options?: { label: string; description?: string }[];
        multi_select?: boolean;
      };

      if (!body.question || typeof body.question !== "string") {
        sendJson(res, 400, { error: "Missing required field: question" });
        return;
      }

      // Build the question text
      const fullMessage = body.context
        ? `*Context:* ${body.context}\n\n*Question:* ${body.question}`
        : `*Question:* ${body.question}`;

      // Map options to SlackQuestionOption[]
      const slackOptions: SlackQuestionOption[] | undefined =
        body.options && body.options.length > 0
          ? body.options.map((o) => ({
              label: o.label,
              description: o.description,
            }))
          : undefined;

      const answer = await sendQuestionAndWait(
        fullMessage,
        body.slack_user_id,
        slackOptions,
        body.multi_select,
      );

      sendJson(res, 200, { answer });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[Server] Error handling /api/ask:", message);
      sendJson(res, 500, { error: message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

async function main() {
  console.error(`[ask-slack-mcp-server] v${VERSION}`);

  await startBoltApp();

  httpServer.listen(PORT, () => {
    console.error(`[Server] Listening on port ${PORT}`);
  });

  const shutdown = async () => {
    console.error("[Server] Shutting down...");
    httpServer.close();
    await stopBoltApp();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown());
  process.on("SIGTERM", () => shutdown());
}

main();
