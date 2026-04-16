import { WebClient } from "@slack/web-api";
import { App, BlockAction } from "@slack/bolt";

interface GenericMessageEvent {
  type: "message";
  subtype?: string;
  bot_id?: string;
  channel: string;
  text?: string;
  thread_ts?: string;
  ts: string;
  user?: string;
}

export interface SlackQuestionOption {
  label: string;
  description?: string;
}

interface Deferred {
  promise: Promise<string>;
  resolve: (value: string) => void;
}

function createDeferred(): Deferred {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((r) => { resolve = r; });
  return { promise, resolve };
}

function raceWithAbort(promise: Promise<string>, signal?: AbortSignal): Promise<string> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("Client disconnected"));
  return new Promise<string>((resolve, reject) => {
    const onAbort = () => reject(new Error("Client disconnected"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then((answer) => {
      signal.removeEventListener("abort", onAbort);
      resolve(answer);
    });
  });
}

interface PendingQuestion {
  deferred: Deferred;
  options?: SlackQuestionOption[];
  multiSelect?: boolean;
  messageTs: string; // timestamp of the sent question — used for polling fallback
}

const STARTUP_DELAY_MS = 6000; // Wait for stale Slack connections to expire
const POLL_INTERVAL_MS = 15_000; // Poll every 15s as fallback for dead Socket Mode

const pendingQuestions = new Map<string, PendingQuestion>();

// Cache of recently answered questions so reconnecting clients can pick up the answer
const resolvedAnswers = new Map<string, string>();
const RESOLVED_ANSWER_TTL_MS = 5 * 60 * 1000; // 5 minutes

let pollTimer: ReturnType<typeof setInterval> | undefined;

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

const boltApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// --- Helpers ---

function resolvePending(channelId: string, answer: string): boolean {
  const pending = pendingQuestions.get(channelId);
  if (!pending) return false;
  console.error("[Bolt] Resolving pending question for channel:", channelId, "with:", answer);
  pending.deferred.resolve(answer);
  pendingQuestions.delete(channelId);

  // Cache the answer so reconnecting clients can still pick it up
  resolvedAnswers.set(channelId, answer);
  setTimeout(() => resolvedAnswers.delete(channelId), RESOLVED_ANSWER_TTL_MS);

  // Confirm to the user on Slack that the answer was received
  web.chat.postMessage({
    channel: channelId,
    text: `✅ Your answer: ${answer}`,
    mrkdwn: true,
  }).catch((err) => {
    console.error("[Bolt] Failed to send confirmation message:", err);
  });

  return true;
}

function formatSelected(labels: string[]): string {
  return `Selected: ${labels.join(", ")}`;
}

function tryParseNumberedReply(
  text: string,
  options: SlackQuestionOption[],
): string | null {
  const trimmed = text.trim();
  const parts = trimmed.split(/[\s,]+/);
  const numbers = parts.map((s) => parseInt(s, 10));

  if (parts.length === 0) return null;
  if (numbers.some((n) => isNaN(n))) return null;
  if (numbers.some((n) => n < 1 || n > options.length)) return null;

  const selectedLabels = numbers.map((n) => options[n - 1].label);
  return formatSelected(selectedLabels);
}

// --- Block Kit message builder ---

function buildOptionsBlocks(
  questionText: string,
  options: SlackQuestionOption[],
  multiSelect: boolean,
): object[] {
  const blocks: object[] = [];

  // Question text
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: questionText },
  });

  // Numbered list for reference + text reply fallback
  const numberedList = options
    .map(
      (o, i) =>
        `${i + 1}. ${o.label}${o.description ? ` — _${o.description}_` : ""}`,
    )
    .join("\n");
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: numberedList },
  });

  if (multiSelect) {
    // Checkboxes + Submit button
    blocks.push({
      type: "actions",
      block_id: "ask_slack_options",
      elements: [
        {
          type: "checkboxes",
          action_id: "ask_slack_checkboxes",
          options: options.map((o) => ({
            text: {
              type: "mrkdwn" as const,
              text: `*${o.label}*${o.description ? `\n${o.description}` : ""}`,
            },
            value: o.label,
          })),
        },
        {
          type: "button",
          action_id: "ask_slack_submit",
          text: { type: "plain_text" as const, text: "✅ Submit" },
          style: "primary",
        },
      ],
    });
  } else {
    // Individual buttons for single select
    blocks.push({
      type: "actions",
      block_id: "ask_slack_options",
      elements: options.map((o, i) => ({
        type: "button",
        action_id: `ask_slack_btn_${i}`,
        text: { type: "plain_text" as const, text: o.label },
        value: o.label,
      })),
    });
  }

  // Help text
  const helpText = multiSelect
    ? '_You can also reply with option numbers, e.g. "1, 3"_'
    : '_You can also reply with the option number, e.g. "1"_';
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: helpText }],
  });

  return blocks;
}

// --- Bolt listeners ---

// Text reply in DM
boltApp.message(async ({ message }) => {
  const msg = message as GenericMessageEvent;

  console.error("[Bolt] Received message:", {
    channel: msg.channel,
    thread_ts: msg.thread_ts,
    subtype: msg.subtype,
    bot_id: msg.bot_id,
    text: msg.text,
    pendingKeys: [...pendingQuestions.keys()],
  });

  if (msg.bot_id || msg.subtype === "bot_message") {
    console.error("[Bolt] Ignoring bot message, skipping.");
    return;
  }

  if (msg.subtype !== undefined) {
    console.error("[Bolt] Ignoring message subtype:", msg.subtype);
    return;
  }

  const pending = pendingQuestions.get(msg.channel);
  if (!pending || !msg.text) {
    console.error("[Bolt] No pending question for channel:", msg.channel);
    return;
  }

  let answer = msg.text;

  // If options exist, try to parse numbered reply (e.g. "1, 3")
  if (pending.options && pending.options.length > 0) {
    const parsed = tryParseNumberedReply(msg.text, pending.options);
    if (parsed) {
      answer = parsed;
    }
    // Otherwise pass through as freeform text
  }

  resolvePending(msg.channel, answer);
});

// Single-select button click
boltApp.action(/^ask_slack_btn_\d+$/, async ({ body, ack }) => {
  await ack();

  const blockBody = body as BlockAction;
  const channelId = blockBody.channel?.id;
  if (!channelId) return;

  const action = blockBody.actions[0];
  const selectedLabel =
    action.type === "button" ? (action as { value: string }).value : "";

  if (selectedLabel) {
    console.error("[Bolt] Button clicked:", selectedLabel, "in channel:", channelId);
    resolvePending(channelId, formatSelected([selectedLabel]));
  }
});

// Checkbox toggle — just acknowledge, wait for Submit
boltApp.action("ask_slack_checkboxes", async ({ ack }) => {
  await ack();
});

// Submit button for multi-select checkboxes
boltApp.action("ask_slack_submit", async ({ body, ack }) => {
  await ack();

  const blockBody = body as BlockAction;
  const channelId = blockBody.channel?.id;
  if (!channelId) return;

  const stateValues = (
    blockBody.state as
      | { values: Record<string, Record<string, { selected_options?: { value: string }[] }>> }
      | undefined
  )?.values;

  const checkboxState = stateValues?.["ask_slack_options"]?.["ask_slack_checkboxes"];
  const selectedLabels =
    checkboxState?.selected_options?.map((opt) => opt.value) ?? [];

  if (selectedLabels.length === 0) {
    console.error("[Bolt] Submit clicked but no options selected");
    return;
  }

  console.error("[Bolt] Submit — selected:", selectedLabels, "in channel:", channelId);
  resolvePending(channelId, formatSelected(selectedLabels));
});

// --- Polling fallback ---
// When Socket Mode dies silently, we poll conversations.history to pick up replies.

async function pollForReplies(): Promise<void> {
  for (const [channelId, pending] of pendingQuestions) {
    try {
      const history = await web.conversations.history({
        channel: channelId,
        oldest: pending.messageTs,
        inclusive: false,
        limit: 10,
      });

      const messages = history.messages ?? [];
      // Find the first human (non-bot) reply
      for (const msg of messages) {
        if ((msg as { bot_id?: string }).bot_id) continue;
        if ((msg as { subtype?: string }).subtype) continue;
        const text = (msg as { text?: string }).text;
        if (!text) continue;

        let answer = text;
        if (pending.options && pending.options.length > 0) {
          const parsed = tryParseNumberedReply(text, pending.options);
          if (parsed) answer = parsed;
        }

        console.error("[Poll] Found reply via polling for channel:", channelId, "answer:", answer);
        resolvePending(channelId, answer);
        break;
      }
    } catch (err) {
      console.error("[Poll] Error polling channel", channelId, err);
    }
  }

  // Stop polling when no more pending questions
  if (pendingQuestions.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
    console.error("[Poll] No more pending questions, polling stopped.");
  }
}

function ensurePolling(): void {
  if (pollTimer) return;
  console.error(`[Poll] Starting polling fallback (every ${POLL_INTERVAL_MS / 1000}s)`);
  pollTimer = setInterval(() => {
    pollForReplies().catch((err) => {
      console.error("[Poll] Unhandled error in pollForReplies:", err);
    });
  }, POLL_INTERVAL_MS);
}

// --- Exported functions ---

export async function startBoltApp(): Promise<void> {
  console.error(`[Bolt] Waiting ${STARTUP_DELAY_MS / 1000}s for stale connections to expire...`);
  await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS));

  await boltApp.start();
  console.error("[Bolt] Socket Mode app started successfully.");
}

export async function stopBoltApp(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  await boltApp.stop();
  console.error("[Bolt] Socket Mode app stopped.");
}

export async function sendQuestionAndWait(
  question: string,
  slackUserId?: string,
  options?: SlackQuestionOption[],
  multiSelect?: boolean,
  signal?: AbortSignal,
): Promise<string> {
  const userId = slackUserId ?? process.env.SLACK_USER_ID;
  if (!userId) {
    throw new Error(
      "Missing slack_user_id parameter and SLACK_USER_ID environment variable",
    );
  }

  // Open DM channel with user
  const dmResult = await web.conversations.open({ users: userId });
  const channelId = (dmResult.channel as { id: string }).id;

  // Build and send message
  const hasOptions = options && options.length > 0;
  let sentResult: { ts?: string };

  if (hasOptions) {
    const blocks = buildOptionsBlocks(question, options, multiSelect ?? false);
    sentResult = await web.chat.postMessage({
      channel: channelId,
      text: question, // fallback for notifications
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks: blocks as any,
      mrkdwn: true,
    });
  } else {
    sentResult = await web.chat.postMessage({
      channel: channelId,
      text: question,
      mrkdwn: true,
    });
  }

  // Wait for response (text reply or interactive action) — no server-side timeout,
  // the client controls how long to wait via its own HTTP timeout.
  console.error(
    `[Slack] Waiting for reply in channel ${channelId} (no timeout)`,
  );

  // Use a deferred promise so that if the HTTP client disconnects,
  // the pending question survives and can be picked up by /api/wait.
  const deferred = createDeferred();
  pendingQuestions.set(channelId, {
    deferred,
    options: hasOptions ? options : undefined,
    multiSelect,
    messageTs: sentResult.ts!,
  });

  ensurePolling();

  return raceWithAbort(deferred.promise, signal);
}

/**
 * Re-attach to an existing pending question without sending a new Slack message.
 * Used by the reconnect flow when the HTTP connection drops before the user answers.
 */
export async function waitForExistingQuestion(
  slackUserId?: string,
  signal?: AbortSignal,
): Promise<string> {
  const userId = slackUserId ?? process.env.SLACK_USER_ID;
  if (!userId) {
    throw new Error(
      "Missing slack_user_id parameter and SLACK_USER_ID environment variable",
    );
  }

  const dmResult = await web.conversations.open({ users: userId });
  const channelId = (dmResult.channel as { id: string }).id;

  // If the answer arrived between disconnect and reconnect, return it immediately
  const cachedAnswer = resolvedAnswers.get(channelId);
  if (cachedAnswer !== undefined) {
    resolvedAnswers.delete(channelId);
    return cachedAnswer;
  }

  const pending = pendingQuestions.get(channelId);
  if (!pending) {
    throw new Error("No pending question found for this user");
  }

  console.error(
    `[Slack] Client reconnected — re-attaching to pending question in channel ${channelId}`,
  );
  return raceWithAbort(pending.deferred.promise, signal);
}
