export interface AskSlackConfig {
  timeoutSeconds: number;
  apiUrl: string;
  apiKey: string;
  slackUserId: string;
}

export interface AskSlackOption {
  label: string;
  description?: string;
}

/**
 * Node 18+ fetch (undici) resolves `localhost` to IPv6 `::1` first.
 * Docker on Windows/Mac typically only binds on IPv4, causing "fetch failed".
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/\/localhost([:/?#])/i, "//127.0.0.1$1");
}

export async function askViaSlackApi(
  config: AskSlackConfig,
  question: string,
  context?: string,
  options?: AskSlackOption[],
  multiSelect?: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    question,
    slack_user_id: config.slackUserId,
  };
  if (context) {
    body.context = context;
  }
  if (options && options.length > 0) {
    body.options = options;
  }
  if (multiSelect !== undefined) {
    body.multi_select = multiSelect;
  }

  const response = await fetch(`${normalizeUrl(config.apiUrl)}/api/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      `API error ${response.status}: ${errorBody.error ?? response.statusText}`,
    );
  }

  const result = (await response.json()) as { answer: string; question_id?: string };
  return result.answer;
}

const RECONNECT_DELAY_MS = 5000;

/**
 * Wait for the answer to an already-sent Slack question (reconnect flow).
 * Does NOT send a new message — just re-attaches to the pending question on the server.
 */
async function waitForSlackAnswer(config: AskSlackConfig): Promise<string> {
  const response = await fetch(`${normalizeUrl(config.apiUrl)}/api/wait`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify({ slack_user_id: config.slackUserId }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      `API error ${response.status}: ${errorBody.error ?? response.statusText}`,
    );
  }

  const result = (await response.json()) as { answer: string };
  return result.answer;
}

/**
 * Send a question to Slack and wait for the answer.
 * If the connection drops before the user responds, automatically reconnect
 * and keep waiting — without resending the message — forever.
 */
export async function askViaSlackApiWithRetry(
  config: AskSlackConfig,
  question: string,
  context?: string,
  options?: AskSlackOption[],
  multiSelect?: boolean,
): Promise<string> {
  // First attempt: send the message and wait
  try {
    return await askViaSlackApi(config, question, context, options, multiSelect);
  } catch (err) {
    console.warn("[ask-slack] Initial request failed, will reconnect:", err);
  }

  // Reconnect loop: just wait for the answer, never resend the message
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await waitForSlackAnswer(config);
    } catch (err) {
      console.warn(
        `[ask-slack] Reconnect attempt failed, retrying in ${RECONNECT_DELAY_MS / 1000}s:`,
        err,
      );
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
    }
  }
}
