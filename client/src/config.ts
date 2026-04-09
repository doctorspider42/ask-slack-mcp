export interface ApiConfig {
  apiUrl: string;
  apiKey: string;
  slackUserId: string;
}

export function getApiConfig(): ApiConfig {
  const apiUrl = process.env.ASK_SLACK_API_URL;
  const apiKey = process.env.ASK_SLACK_API_KEY;
  const slackUserId = process.env.SLACK_USER_ID;

  if (!apiUrl || !apiKey) {
    throw new Error(
      "Missing ASK_SLACK_API_URL or ASK_SLACK_API_KEY environment variables",
    );
  }

  if (!slackUserId) {
    throw new Error(
      "Missing SLACK_USER_ID environment variable",
    );
  }

  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey, slackUserId };
}
