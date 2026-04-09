#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sendQuestionAndWait, startBoltApp } from "./slack.js";

const server = new McpServer({
  name: "ask-user-in-slack",
  version: "1.0.1",
});

server.tool(
  "ask_user",
  "Ask the user a question and wait for their response",
  {
    question: z.string().describe("The question to ask"),
    context: z
      .string()
      .optional()
      .describe("Optional context for the question"),
  },
  async ({ question, context }) => {
    const fullMessage = context
      ? `*Context:* ${context}\n\n*Question:* ${question}`
      : `*Question:* ${question}`;

    const answer = await sendQuestionAndWait(fullMessage);

    return {
      content: [{ type: "text", text: answer }],
    };
  }
);

await startBoltApp();

const transport = new StdioServerTransport();
await server.connect(transport);
