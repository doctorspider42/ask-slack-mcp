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

  const result = (await response.json()) as { answer: string };
  return result.answer;
}
