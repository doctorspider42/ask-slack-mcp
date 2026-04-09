import { ApiConfig } from "./config.js";

export interface AskOption {
  label: string;
  description?: string;
}

export async function askViaApi(
  config: ApiConfig,
  question: string,
  context?: string,
  options?: AskOption[],
  multiSelect?: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    question,
    slack_user_id: config.slackUserId,
  };
  if (context) body.context = context;
  if (options && options.length > 0) body.options = options;
  if (multiSelect !== undefined) body.multi_select = multiSelect;

  const response = await fetch(`${config.apiUrl}/api/ask`, {
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
