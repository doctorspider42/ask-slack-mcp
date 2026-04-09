import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sendQuestionAndWait, startBoltApp } from "./slack.js";

const server = new McpServer({
  name: "slack-human-in-the-loop",
  version: "1.0.0",
});

server.tool(
  "ask_user",
  "Zadaj pytanie użytkownikowi przez Slack i poczekaj na odpowiedź",
  {
    question: z.string().describe("Pytanie do zadania użytkownikowi"),
    context: z
      .string()
      .optional()
      .describe("Opcjonalny kontekst zadania"),
  },
  async ({ question, context }) => {
    const fullMessage = context
      ? `*Kontekst:* ${context}\n\n*Pytanie:* ${question}`
      : `*Pytanie od AI:* ${question}`;

    const answer = await sendQuestionAndWait(fullMessage);

    return {
      content: [{ type: "text", text: answer }],
    };
  }
);

await startBoltApp();

const transport = new StdioServerTransport();
await server.connect(transport);
