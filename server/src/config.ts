export function getServerPort(): number {
  return parseInt(process.env.PORT ?? "3000", 10);
}

export function getServerApiKey(): string {
  const key = process.env.ASK_SLACK_API_KEY;
  if (!key) {
    throw new Error("Missing ASK_SLACK_API_KEY environment variable");
  }
  return key;
}
