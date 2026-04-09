#!/usr/bin/env node
import "dotenv/config";
import { createRequire } from "module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getApiConfig } from "./config.js";
import { askViaApi } from "./api-client.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json") as { version: string };

const apiConfig = getApiConfig();
console.error(`[ask-slack-mcp] Starting version ${VERSION}`);
console.error(`[ask-slack-mcp] API URL: ${apiConfig.apiUrl}`);

const server = new McpServer({
  name: "ask-user-in-slack",
  version: VERSION,
});

server.tool(
  "ask_user",
  "Ask a user a question via Slack DM and wait for their response",
  {
    question: z.string().describe("The question to ask"),
    context: z
      .string()
      .optional()
      .describe("Optional context for the question"),
  },
  async ({ question, context }) => {
    const answer = await askViaApi(apiConfig, question, context);
    return { content: [{ type: "text", text: answer }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
