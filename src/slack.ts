import { WebClient } from "@slack/web-api";
import { App } from "@slack/bolt";

interface GenericMessageEvent {
  type: "message";
  subtype?: string;
  channel: string;
  text?: string;
  ts: string;
  user?: string;
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minut

// Mapa: channelId -> resolver oczekującego Promise
const pendingQuestions = new Map<string, (answer: string) => void>();

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

const boltApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  socketMode: true, // Socket Mode — nie wymaga publicznego URL
  appToken: process.env.SLACK_APP_TOKEN,
});

// Listener: gdy użytkownik odpowie w DM
boltApp.message(async ({ message }) => {
  const msg = message as GenericMessageEvent;

  // Obsługuj tylko wiadomości bezpośrednie napisane przez użytkownika (nie przez bota)
  if (msg.subtype !== undefined) return;

  const resolver = pendingQuestions.get(msg.channel);
  if (resolver && msg.text) {
    resolver(msg.text);
    pendingQuestions.delete(msg.channel);
  }
});

export async function startBoltApp(): Promise<void> {
  await boltApp.start();
}

export async function sendQuestionAndWait(question: string): Promise<string> {
  const slackUserId = process.env.SLACK_USER_ID;
  if (!slackUserId) {
    throw new Error("Brak zmiennej środowiskowej SLACK_USER_ID");
  }

  // Otwórz kanał DM z użytkownikiem
  const dmResult = await web.conversations.open({ users: slackUserId });
  const channelId = (dmResult.channel as { id: string }).id;

  // Wyślij wiadomość
  await web.chat.postMessage({
    channel: channelId,
    text: question,
    mrkdwn: true,
  });

  // Czekaj na odpowiedź (Promise z timeoutem)
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingQuestions.delete(channelId);
      reject(
        new Error(
          "Timeout — użytkownik nie odpowiedział w ciągu 5 minut"
        )
      );
    }, TIMEOUT_MS);

    pendingQuestions.set(channelId, (answer: string) => {
      clearTimeout(timer);
      resolve(answer);
    });
  });
}
