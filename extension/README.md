# Ask Slack — VS Code Extension

Going to the bathroom and worried your AI agent will be stuck waiting for you with a question? Grabbing coffee while a long task runs, only to come back and find Copilot froze 10 minutes ago asking "should I use tabs or spaces?"

**Relax.** This extension forwards agent questions straight to your Slack DMs so you can answer from your phone, your couch, or yes — the bathroom.

## How it works

`#ask_slack` is a Copilot Chat tool that shows a **native inline prompt** when the agent needs your input. If you don't answer within the timeout, the question is automatically forwarded to your **Slack DM**. The first answer wins — whether you type it in VS Code or tap it on your phone.

```
Agent asks question
        │
        ├──→ VS Code inline prompt (immediate)
        │
        └──→ Slack DM (after timeout, default 60s)
                │
        ← first answer wins ←
```

## Setup

1. **Deploy the server** — follow the [server setup guide](https://github.com/doctorspider42/ask-slack-mcp#server)
2. **Install the extension** in VS Code
3. **Open settings** — run `Ask Slack: Open Settings` from the Command Palette, or go to Settings → Ask Slack
4. **Configure:**
   - **API URL** — your server URL (e.g. `https://ask-slack.yourcompany.com` or `http://localhost:3000`)
   - **API Key** — the shared secret you set on the server (`ASK_SLACK_API_KEY`)
   - **Slack User ID** — your personal Slack member ID (profile → `⋯` → Copy member ID)
5. **Test connection** — click "Test Connection" in the settings panel

If you leave the connection fields empty, the tool works in **local-only mode** — just the inline prompt, no Slack fallback.

## Usage

Reference the tool in your Copilot Chat prompts or `.github/copilot-instructions.md`:

```
If you need to ask the user a question, use #ask_slack
```

The agent can send plain questions or multiple-choice options:

```
Use #ask_slack with question "Which approach?" and options ["Refactor", "Rewrite", "Keep as-is"]
```

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `askSlack.timeoutSeconds` | `60` | Seconds before Slack fallback kicks in |
| `askSlack.apiUrl` | `""` | Server URL |
| `askSlack.slackUserId` | `""` | Your Slack user ID |
| `askSlack.awayMode` | `false` | Skip local prompt, send straight to Slack |

API key is stored securely in OS keychain — configure it via the settings panel.

### Away Mode

Toggle **Away Mode** and questions skip the local prompt entirely — they go straight to Slack. Perfect for when you step away but want your agents to keep working.

## Features

- **Inline question UI** — same native carousel as `vscode_askQuestions`, with options, multi-select, and freeform input
- **Slack DM fallback** — unanswered questions are forwarded to Slack with interactive buttons/checkboxes (Block Kit)
- **Away Mode** — send everything to Slack immediately, no local prompt
- **Numbered reply fallback** — reply with `1` or `1, 3` in Slack instead of clicking buttons
- **Secure** — API key stored in OS keychain (Windows Credential Manager / macOS Keychain)
- **Settings GUI** — configure everything from a webview panel (`Ask Slack: Open Settings`)

## Requirements

This extension needs a running **ask-slack-mcp server** to forward questions to Slack.

👉 **[Server setup instructions on GitHub](https://github.com/doctorspider42/ask-slack-mcp#server)**

The server holds the Slack WebSocket connection and exposes an HTTP API. You deploy it once; the extension connects to it.

## Tool Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `question` | string | Yes | The question to ask |
| `context` | string | No | Context shown above the question |
| `options` | array | No | Selectable answers (`{ label, description?, recommended? }`) |
| `multiSelect` | boolean | No | Allow picking multiple options |
| `allowFreeformInput` | boolean | No | Allow typed answer alongside options |

## Development

```bash
cd extension
npm install
npm run compile
```

Press **F5** to launch the Extension Development Host. See [extension development docs](https://github.com/doctorspider42/ask-slack-mcp/blob/main/docs/extension-development.md) for details.

### Package as VSIX

```bash
npx @vscode/vsce package
```

## Links

- [GitHub Repository](https://github.com/doctorspider42/ask-slack-mcp)
- [Server Setup Guide](https://github.com/doctorspider42/ask-slack-mcp#server)
- [Slack App Setup](https://github.com/doctorspider42/ask-slack-mcp#slack-app-setup)
- [Azure Deployment Guide](https://github.com/doctorspider42/ask-slack-mcp/blob/main/docs/azure-deployment.md)

## License

MIT
