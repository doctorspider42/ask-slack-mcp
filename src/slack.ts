import { WebClient } from "@slack/web-api";
import { App } from "@slack/bolt";

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

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Map: channelId -> resolver of pending Promise
const pendingQuestions = new Map<string, (answer: string) => void>();

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

const boltApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  socketMode: true, // Socket Mode — nie wymaga publicznego URL
  appToken: process.env.SLACK_APP_TOKEN,
});

// Listener: when user replies in DM
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

  // Ignore bot messages (including own)
  if (msg.bot_id || msg.subtype === "bot_message") {
    console.error("[Bolt] Ignoring bot message, skipping.");
    return;
  }

  // Ignore other subtypes (e.g. message_changed)
  if (msg.subtype !== undefined) {
    console.error("[Bolt] Ignoring message subtype:", msg.subtype);
    return;
  }

  const resolver = pendingQuestions.get(msg.channel);
  if (resolver && msg.text) {
    console.error("[Bolt] Resolver found for channel:", msg.channel, "— resolving with answer.");
    resolver(msg.text);
    pendingQuestions.delete(msg.channel);
  } else {
    console.error("[Bolt] No pending question for channel:", msg.channel);
  }
});

export async function startBoltApp(): Promise<void> {
  await boltApp.start();
  console.error("[Bolt] Socket Mode app started successfully.");
}

export async function sendQuestionAndWait(question: string): Promise<string> {
  const slackUserId = process.env.SLACK_USER_ID;
  if (!slackUserId) {
    throw new Error("Missing SLACK_USER_ID environment variable");
  }

  // Open DM channel with user
  const dmResult = await web.conversations.open({ users: slackUserId });
  const channelId = (dmResult.channel as { id: string }).id;

  // Send message
  await web.chat.postMessage({
    channel: channelId,
    text: question,
    mrkdwn: true,
  });

  // Wait for response (Promise with timeout)
  console.error(`[Slack] Waiting for reply in channel ${channelId} (timeout: ${TIMEOUT_MS / 1000}s)`);
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error(`[Slack] TIMEOUT — no reply received for channel ${channelId}`);
      pendingQuestions.delete(channelId);
      reject(
        new Error(
          "Timeout — user did not respond within 5 minutes"
        )
      );
    }, TIMEOUT_MS);

    pendingQuestions.set(channelId, (answer: string) => {
      clearTimeout(timer);
      resolve(answer);
    });
  });
}
