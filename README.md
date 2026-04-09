# ask-slack-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) tool that enables **human-in-the-loop** interactions via Slack DM. AI agents can pause and ask a real human a question, then wait for their reply — directly in Slack.

This repository contains two independent npm packages:

| Folder | npm package | Description |
|--------|-------------|-------------|
| [`client/`](client/) | `ask-slack-mcp` | MCP stdio client — runs on each user's machine |
| [`server/`](server/) | `ask-slack-mcp-server` | HTTP API server — Slack bridge (deploy once) |

## Quick install (client)

Fill in the three env vars after clicking — `ASK_SLACK_API_URL`, `ASK_SLACK_API_KEY`, `SLACK_USER_ID`.

#### npx (requires Node.js)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Server-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)

#### Docker (no Node.js needed)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Docker-0098FF?style=flat-square&logo=docker&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22-e%22%2C%22ASK_SLACK_API_URL%22%2C%22-e%22%2C%22ASK_SLACK_API_KEY%22%2C%22-e%22%2C%22SLACK_USER_ID%22%2C%22node%3A24-alpine%22%2C%22npx%22%2C%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Docker-24bfa5?style=flat-square&logo=docker&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=ask-slack-mcp&quality=insiders&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22-e%22%2C%22ASK_SLACK_API_URL%22%2C%22-e%22%2C%22ASK_SLACK_API_KEY%22%2C%22-e%22%2C%22SLACK_USER_ID%22%2C%22node%3A24-alpine%22%2C%22npx%22%2C%22-y%22%2C%22ask-slack-mcp%22%5D%2C%22env%22%3A%7B%22ASK_SLACK_API_URL%22%3A%22%22%2C%22ASK_SLACK_API_KEY%22%3A%22%22%2C%22SLACK_USER_ID%22%3A%22%22%7D%7D)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│      server/ — API SERVER (one instance)     │
│  Connects to Slack via Socket Mode           │
│  Exposes HTTP API on :3000                   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS + API key
        ┌──────────┴──────────┐
        ▼                     ▼
  ┌───────────┐         ┌───────────┐
  │ client/   │         │ client/   │
  │ MCP User A│         │ MCP User B│
  └───────────┘         └───────────┘
```

One API server holds a single Slack WebSocket connection. Each MCP client sends its `SLACK_USER_ID` with every request, so questions are always delivered to the right person.

---

## Server

The server holds the Slack connection and exposes an HTTP API. Deploy it once; all clients connect to it.

### Slack app setup

Go to [api.slack.com/apps](https://api.slack.com/apps) and configure:

- **Socket Mode** → enable, generate an **App-Level Token** (`xapp-...`) with `connections:write` scope
- **OAuth & Permissions** → bot token scopes: `chat:write`, `im:read`, `im:write`, `im:history`
- **Event Subscriptions** → subscribe to `message.im` bot event
- Install the app to your workspace, copy the **Bot User OAuth Token** (`xoxb-...`)

### Server environment variables

| Variable | Description |
|---|---|
| `ASK_SLACK_API_KEY` | Secret key for authenticating client requests |
| `SLACK_BOT_TOKEN` | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | App-Level Token for Socket Mode (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `PORT` | HTTP port (default: `3000`) |

### Run with npx (quickest)

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

The server is a regular long-running Node.js process — deploy it anywhere that runs Node 18+ or Docker:

- **Azure** — see [docs/azure-deployment.md](docs/azure-deployment.md)
- **Any VPS / VM** — `npx ask-slack-mcp-server` with env vars set
- **Docker host** — use the included `Dockerfile`

### Server endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | none | `{"status":"ok","version":"..."}` |
| `POST /api/ask` | `x-api-key` header | Send a question, wait for Slack reply |

---

## Client

The MCP client runs locally on each user's machine. It connects to the API server — no Slack tokens needed.

Each user needs three values:

| Variable | Description |
|---|---|
| `ASK_SLACK_API_URL` | URL of the API server |
| `ASK_SLACK_API_KEY` | Shared API key |
| `SLACK_USER_ID` | Your personal Slack user ID |

To find your `SLACK_USER_ID`: click your profile in Slack → **View profile** → `⋯` → **Copy member ID**.

### mcp.json (npx)

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

### mcp.json (Docker — no Node.js needed)

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

### Local testing (server on localhost)

```json
{
  "mcpServers": {
    "ask-slack-mcp": {
      "command": "npx",
      "args": ["-y", "ask-slack-mcp"],
      "env": {
        "ASK_SLACK_API_URL": "http://localhost:3000",
        "ASK_SLACK_API_KEY": "your-secret-api-key",
        "SLACK_USER_ID": "U01XXXXXXX"
      }
    }
  }
}
```

---

## Tool reference

### `ask_user`

Ask the configured Slack user a question and wait for their reply.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | The question to ask |
| `context` | string | No | Optional context shown above the question |

**Timeout:** 5 minutes. Throws if no response is received.

---

## All environment variables

| Variable | Where | Description |
|---|---|---|
| `ASK_SLACK_API_URL` | client | URL of the API server |
| `ASK_SLACK_API_KEY` | server + client | Shared secret for API authentication |
| `SLACK_USER_ID` | client | Your Slack user ID — each user sets their own |
| `SLACK_BOT_TOKEN` | server | Bot User OAuth Token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | server | App-Level Token (`xapp-...`) |
| `SLACK_SIGNING_SECRET` | server | Slack app signing secret |
| `PORT` | server | HTTP port (default: `3000`) |

## License

MIT
