#!/usr/bin/env node
/**
 * Test harness for slack.ts
 * Sends a question to the user via Slack DM and prints the answer to stdout.
 * Usage: npx ts-node test-harness.ts
 */
import "dotenv/config";
import * as readline from "readline";
import { sendQuestionAndWait, startBoltApp } from "./slack.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("=== Slack MCP Test Harness ===\n");

  console.log("Starting Bolt app (Socket Mode)...");
  await startBoltApp();
  console.log("✅ Bolt app started.\n");

  let running = true;

  while (running) {
    const input = await prompt('Enter question to send (or "exit" to quit): ');

    if (input.trim().toLowerCase() === "exit") {
      running = false;
      break;
    }

    if (!input.trim()) {
      console.log("⚠️  Empty input, skipping.\n");
      continue;
    }

    const contextInput = await prompt("Optional context (leave blank to skip): ");
    const context = contextInput.trim() || undefined;

    const fullMessage = context
      ? `*Context:* ${context}\n\n*Question:* ${input.trim()}`
      : `*Question:* ${input.trim()}`;

    console.log("\n📤 Sending to Slack...");

    try {
      const start = Date.now();
      const answer = await sendQuestionAndWait(fullMessage);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      console.log(`\n✅ Got answer after ${elapsed}s:`);
      console.log(`   "${answer}"`);
      console.log();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error: ${msg}\n`);
    }
  }

  console.log("\nBye!");
  rl.close();
  process.exit(0);
}

main();