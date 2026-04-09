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
  "Ask a user a question via Slack DM and wait for their response. Supports options with interactive buttons/checkboxes in Slack.",
  {
    question: z.string().describe("The question to ask"),
    context: z
      .string()
      .optional()
      .describe("Optional context for the question"),
    options: z
      .array(
        z.object({
          label: z.string().describe("Display label for the option"),
          description: z
            .string()
            .optional()
            .describe("Optional description for the option"),
        }),
      )
      .optional()
      .describe(
        "Selectable answer options. Rendered as interactive buttons (single select) or checkboxes (multi select) in Slack.",
      ),
    multi_select: z
      .boolean()
      .optional()
      .describe(
        "Allow selecting multiple options. When true, options are shown as checkboxes with a Submit button.",
      ),
  },
  async ({ question, context, options, multi_select }) => {
    const answer = await askViaApi(apiConfig, question, context, options, multi_select);
    return { content: [{ type: "text", text: answer }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
