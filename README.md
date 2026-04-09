# ask-slack-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that enables **human-in-the-loop** interactions via Slack DM. AI agents can pause and ask a real human a question, then wait for their reply — directly in Slack.

## One-click install

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_ask--slack--mcp-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22SLACK_BOT_TOKEN%22%3A%22%22%2C%22SLACK_APP_TOKEN%22%3A%22%22%2C%22SLACK_SIGNING_SECRET%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_ask--slack--mcp-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22SLACK_BOT_TOKEN%22%3A%22%22%2C%22SLACK_APP_TOKEN%22%3A%22%22%2C%22SLACK_SIGNING_SECRET%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)

> **Note:** After clicking, fill in the four environment variables in VS Code's MCP settings: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_USER_ID`. See [Setup](#setup) below.

## How it works

The server exposes a single tool `ask_user`. When called by an AI agent, it:
1. Sends a DM to the configured Slack user
2. Waits up to 5 minutes for their reply
3. Returns the reply as the tool result

## Requirements

- Node.js >= 18
- A Slack app with **Socket Mode** enabled and the following:
  - Bot Token Scopes: `chat:write`, `im:read`, `im:write`, `im:history`
  - Event Subscriptions: `message.im`

## Setup

### 1. Create a Slack app

Go to [api.slack.com/apps](https://api.slack.com/apps), create a new app, and configure:

- **Socket Mode**: Enable it and generate an **App-Level Token** (`xapp-...`) with `connections:write` scope
- **OAuth & Permissions**: Add bot token scopes: `chat:write`, `im:read`, `im:write`, `im:history`
- **Event Subscriptions**: Subscribe to `message.im` bot event
- Install the app to your workspace and copy the **Bot User OAuth Token** (`xoxb-...`)

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```env
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
SLACK_USER_ID=U01XXXXXXX
```

To find your `SLACK_USER_ID`: click your profile in Slack → **View profile** → `⋯` → **Copy member ID**.

### 3. Use with an MCP client

#### npx (no install needed)

```json
{
  "mcpServers": {
    "ask-slack-mcp": {
      "command": "npx",
      "args": ["-y", "ask-slack-mcp"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_APP_TOKEN": "xapp-...",
        "SLACK_SIGNING_SECRET": "...",
        "SLACK_USER_ID": "U01XXXXXXX"
      }
    }
  }
}
```

#### Global install

```bash
npm install -g ask-slack-mcp
```

Then in your MCP config:

```json
{
  "mcpServers": {
    "ask-slack-mcp": {
      "command": "ask-slack-mcp",
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_APP_TOKEN": "xapp-...",
        "SLACK_SIGNING_SECRET": "...",
        "SLACK_USER_ID": "U01XXXXXXX"
      }
    }
  }
}
```

## Tool Reference

### `ask_user`

Ask the configured Slack user a question and wait for their response.

| Parameter  | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `question` | string | Yes      | The question to ask the user       |
| `context`  | string | No       | Optional context for the question  |

**Timeout**: 5 minutes. Throws an error if no response is received.

## License

MIT
