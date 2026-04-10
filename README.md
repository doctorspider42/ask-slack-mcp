# ask-slack-mcp

Let your AI agents ask you questions via **Slack DM** — answer from your phone while the agent keeps running. Human-in-the-loop without being glued to your desk.

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) tool + VS Code extension that enables AI agents to pause, ask a real human a question, and wait for their reply — delivered to Slack and/or directly inside VS Code.

This repository contains three packages:

| Folder | Package | Description |
|--------|---------|-------------|
| [`server/`](server/) | `ask-slack-mcp-server` (npm) | HTTP API server — Slack bridge (deploy once) |
| [`extension/`](extension/) | `ask-slack-vscode` (VS Code) | **Recommended** — VS Code extension with inline prompt + Slack fallback |
| [`client/`](client/) | `ask-slack-mcp` (npm) | MCP stdio client — for non-VS Code environments (Claude Code, Cursor, etc.) |

---

## Recommended: VS Code Extension

The VS Code extension is the recommended way to use this project. It registers a Copilot Chat tool (`#ask_slack`) that shows a **native inline question prompt** inside VS Code. If you don't answer within the timeout, the question is forwarded to your Slack DM — the first answer wins.

**Flow:**
1. Agent calls `#ask_slack` → inline prompt appears in VS Code
2. You answer locally → instant response, no Slack involved
3. Timeout expires (default 60 s) → question sent to Slack DM with interactive buttons
4. First answer wins

**Away Mode:** Skip the local prompt entirely and route everything straight to Slack.

The extension talks directly to the server HTTP API — no MCP client needed. API key is stored securely in the OS keychain.

### Install

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Extension-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=doctorspider.ask-slack-vscode)

Search for **Ask Slack** in the VS Code Extensions view, or click the badge above.

For development / VSIX install instructions, see [extension/README.md](extension/README.md).

### Setup

1. Run `Ask Slack: Open Settings` from the Command Palette
2. Set **API URL**, **API Key**, and **Slack User ID**
3. Click **Test Connection**
4. (Optional) Add to `.github/copilot-instructions.md`:

```
Add Always use #ask_slack tool to ask user questions
```

### Extension settings

| Setting | Default | Description |
|---|---|---|
| `askSlack.apiUrl` | `""` | Server URL (e.g. `https://ask-slack.yourcompany.com`) |
| `askSlack.slackUserId` | `""` | Your Slack user ID |
| `askSlack.timeoutSeconds` | `60` | Seconds before Slack fallback |
| `askSlack.awayMode` | `false` | Skip local prompt, send straight to Slack |

API key is stored in OS keychain — configure it from the settings panel.

If `apiUrl`, `apiKey`, or `slackUserId` are empty, the tool works in **local-only mode** — just the inline prompt, no Slack fallback.

For full extension documentation, see [extension/README.md](extension/README.md).

---

## MCP Client (Claude Code, Cursor, and other MCP hosts)

For environments other than VS Code — such as Claude Code, Cursor, or any other MCP-compatible client — use the `ask-slack-mcp` stdio client. It exposes the same `ask_user` tool over the MCP protocol.

Each user needs three values:

| Variable | Description |
|---|---|
| `ASK_SLACK_API_URL` | URL of the API server |
| `ASK_SLACK_API_KEY` | Shared API key |
| `SLACK_USER_ID` | Your personal Slack user ID |

To find your `SLACK_USER_ID`: click your profile in Slack → **View profile** → `⋯` → **Copy member ID**.

### Quick install (one-click)

Fill in the three env vars after clicking.

#### npx (requires Node.js)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_MCP_Client-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_MCP_Client-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)

#### Docker (no Node.js needed)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Docker-0098FF?style=flat-square&logo=docker&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22-e%22%2C%22ASK_SLACK_API_URL%22%2C%22-e%22%2C%22ASK_SLACK_API_KEY%22%2C%22-e%22%2C%22SLACK_USER_ID%22%2C%22node%3A24-alpine%22%2C%22npx%22%2C%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Docker-24bfa5?style=flat-square&logo=docker&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22-e%22%2C%22ASK_SLACK_API_URL%22%2C%22-e%22%2C%22ASK_SLACK_API_KEY%22%2C%22-e%22%2C%22SLACK_USER_ID%22%2C%22node%3A24-alpine%22%2C%22npx%22%2C%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)

### Manual config — mcp.json (npx)

```json
{
  "mcpServers": {
    "ask-slack-mcp": {
      "command": "npx",
      "args": ["-y", "ask-slack-mcp"],
      "env": {
        "ASK_SLACK_API_URL": "https://your-server-url",
        "ASK_SLACK_API_KEY": "your-secret-api-key",
        "SLACK_USER_ID": "U01XXXXXXX"
      }
    }
  }
}
```

### Manual config — mcp.json (Docker)

```json
{
  "mcpServers": {
    "ask-slack-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "ASK_SLACK_API_URL",
        "-e", "ASK_SLACK_API_KEY",
        "-e", "SLACK_USER_ID",
        "node:24-alpine", "npx", "-y", "ask-slack-mcp"
      ],
      "env": {
        "ASK_SLACK_API_URL": "https://your-server-url",
        "ASK_SLACK_API_KEY": "your-secret-api-key",
        "SLACK_USER_ID": "U01XXXXXXX"
      }
    }
  }
}
```

---

## Server

The server holds the Slack WebSocket connection and exposes an HTTP API. Deploy it once — all clients (extension, MCP client) connect to it.

### Slack app setup

Go to [api.slack.com/apps](https://api.slack.com/apps) and configure:

- **Socket Mode** → enable, generate an **App-Level Token** (`xapp-...`) with `connections:write` scope
- **Interactivity & Shortcuts** → enable (required for interactive buttons/checkboxes in Block Kit)
- **OAuth & Permissions** → bot token scopes: `chat:write`, `im:read`, `im:write`, `im:history`
- **Event Subscriptions** → subscribe to `message.im` bot event
- Install the app to your workspace, copy the **Bot User OAuth Token** (`xoxb-...`)

### Environment variables

| Variable | Description |
|---|---|
| `ASK_SLACK_API_KEY` | Secret key for authenticating client requests |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | App-Level Token for Socket Mode (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `PORT` | HTTP port (default: `3000`) |

### Run with npx

```bash
ASK_SLACK_API_KEY=your-secret \
SLACK_BOT_TOKEN=xoxb-... \
SLACK_APP_TOKEN=xapp-... \
SLACK_SIGNING_SECRET=... \
  npx ask-slack-mcp-server
```

### Run with Docker

```bash
cd server
docker build -t ask-slack-mcp-server .
docker run --env-file .env -p 3000:3000 ask-slack-mcp-server
```

### Deploy remotely

- **Azure** — see [docs/azure-deployment.md](docs/azure-deployment.md)
- **Any VPS / VM** — `npx ask-slack-mcp-server` with env vars set
- **Docker host** — use the included `Dockerfile`

### Endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | none | `{"status":"ok","version":"..."}` |
| `POST /api/ask` | `x-api-key` header | Send a question, wait for Slack reply |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│      server/ — API SERVER (one instance)     │
│  Connects to Slack via Socket Mode           │
│  Exposes HTTP API on :3000                   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS + API key
        ┌──────────┼──────────────────┐
        ▼          ▼                  ▼
  ┌───────────┐ ┌───────────┐  ┌──────────────┐
  │ client/   │ │ client/   │  │ extension/   │
  │ MCP User A│ │ MCP User B│  │ VS Code ext  │
  └───────────┘ └───────────┘  └──────────────┘
```

One server holds a single Slack WebSocket connection. Each client sends its `SLACK_USER_ID` with every request so questions reach the right person.

---

## Tool reference

### `ask_user` (MCP) / `#ask_slack` (VS Code extension)

Ask the configured Slack user a question and wait for their reply. Supports plain text and multiple-choice options.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | The question to ask |
| `context` | string | No | Optional context shown above the question |
| `options` | array | No | Selectable answers (`{ label, description? }`) — rendered as buttons or checkboxes in Slack |
| `multi_select` | boolean | No | Allow selecting multiple options (checkboxes + Submit in Slack) |

**VS Code extension** also supports `allowFreeformInput` (boolean) — allow a typed answer alongside options.

When options are used, Slack renders **Block Kit buttons** (single select) or **checkboxes** (multi select). Users can also reply with option numbers (e.g. `1` or `1, 3`).

**Timeout:** 5 minutes (server-side). Throws if no response is received.

---

## All environment variables / settings

| Variable | Where | Description |
|---|---|---|
| `ASK_SLACK_API_URL` | client, extension | URL of the API server |
| `ASK_SLACK_API_KEY` | server, client, extension | Shared secret for API authentication |
| `SLACK_USER_ID` | client, extension | Your Slack user ID — each user sets their own |
| `SLACK_BOT_TOKEN` | server | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | server | App-Level Token (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | server | Slack app signing secret |
| `PORT` | server | HTTP port (default: `3000`) |
| `askSlack.timeoutSeconds` | extension | Seconds before Slack fallback (default: `60`) |
| `askSlack.awayMode` | extension | Skip local prompt, send straight to Slack (default: `false`) |

## License

MIT
