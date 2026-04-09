# VS Code Extension — Development Guide

This document covers how to build, test locally, and publish the `ask-slack-vscode` extension.

## Prerequisites

- Node.js >= 18
- VS Code >= 1.99.0 (Insiders recommended for latest Copilot Chat API)
- The `server/` running somewhere (local or remote) for Slack fallback

## Project structure

```
extension/
├── package.json          # Extension manifest (contributes tools, settings, commands)
├── tsconfig.json
├── .vscodeignore
└── src/
    ├── extension.ts      # activate() — registers tool + settings command
    ├── askUserTool.ts     # Tool implementation — inline carousel + Slack race
    ├── slackApiClient.ts  # HTTP client for the server API
    └── settingsPanel.ts   # Webview settings GUI
```

The extension is **standalone** — it has its own HTTP client and does NOT depend on the `client/` MCP package.

## Build

```bash
cd extension
npm install
npm run compile        # tsc -p ./
```

Output goes to `extension/dist/`.

## Run in development (Extension Development Host)

1. Open the repo root in VS Code
2. Go to **Run and Debug** → select **Launch Extension** (or create the config below)
3. Press `F5` — a new VS Code window opens with the extension loaded
4. In the new window, open Copilot Chat and use `#ask_slack`

### launch.json config

Add this to `.vscode/launch.json` if it doesn't exist:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/extension"
      ],
      "outFiles": [
        "${workspaceFolder}/extension/dist/**/*.js"
      ],
      "preLaunchTask": "npm: compile - extension"
    }
  ]
}
```

### Extension settings for development

In the Extension Development Host window, configure settings via the **Command Palette** → `Ask Slack: Open Settings` or in `settings.json`:

```json
{
  "askSlack.apiUrl": "http://localhost:3000",
  "askSlack.apiKey": "your-secret-api-key",
  "askSlack.slackUserId": "U01XXXXXXX",
  "askSlack.timeoutSeconds": 15
}
```

The settings webview includes a **Test Connection** button that checks the server health endpoint.

Use a short `timeoutSeconds` (e.g. 15) during development to test the Slack fallback quickly.

## Package as VSIX

Install the packaging tool:

```bash
npm install -g @vscode/vsce
```

Build the VSIX:

```bash
cd extension
npm run compile
vsce package
```

This creates `ask-slack-vscode-0.1.0.vsix`.

## Install VSIX locally

```bash
code --install-extension ask-slack-vscode-0.1.0.vsix
```

Or in VS Code: **Extensions** → `...` menu → **Install from VSIX…**

To uninstall:

```bash
code --uninstall-extension doctorspider42.ask-slack-vscode
```

## Publish to Marketplace

### One-time setup

1. Create a publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Create a Personal Access Token (PAT) in [Azure DevOps](https://dev.azure.com/) with **Marketplace (Publish)** scope
3. Login:

```bash
vsce login doctorspider42
# Paste your PAT when prompted
```

### Publish

```bash
cd extension
npm run compile
vsce publish
```

To publish a specific version:

```bash
vsce publish 0.2.0
```

To publish a pre-release:

```bash
vsce publish --pre-release
```

### After publishing

The one-click install badge in `README.md` can be uncommented:

```md
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Extension-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=doctorspider42.ask-slack-vscode)
```

## How it works

### Tool registration

The extension registers a [Language Model Tool](https://code.visualstudio.com/api/extension-guides/language-model-tool-calling) via `vscode.lm.registerTool()`. This makes the tool available to Copilot Chat agents as `#ask_slack`.

The tool is declared in `package.json` under `contributes.languageModelTools` with:
- `name`: `askSlack_askUser` (internal ID)
- `toolReferenceName`: `ask_slack` (what users type in chat: `#ask_slack`)
- Input schema: `question` (required) + `context` (optional)

### Race logic

When the tool is invoked, it calls the built-in `vscode_askQuestions` core tool to render an **inline question carousel** directly in the Copilot Chat pane (same UI as the native ask-questions tool):

```
Agent calls #ask_slack("What color?")
              │
              ▼
     ┌─── Inline carousel (vscode_askQuestions) ──────┐
     │  Shows question + free-text input in chat       │
     │  Note: "If no answer in 60s → sent to Slack"   │
     └─────────────┬───────────────────────────────────┘
                   │
      ┌────────────┼─────────────┐
      │ User types │ 60s timeout │
      │  answer    │  expires    │
      ▼            │             ▼
   Return answer   │     Send to Slack API
   immediately     │     (carousel stays open)
                   │             │
                   │   ┌────────┼────────┐
                   │   │ User   │ Slack  │
                   │   │ types  │ reply  │
                   │   ▼        ▼        │
                   │  Return   Cancel    │
                   │  local    carousel, │
                   │  answer   return    │
                   │           Slack     │
                   │           answer    │
                   └────────────────────┘
                     First one wins!
```

If the user **skips** the carousel question, the question is sent to Slack immediately (if configured).

### Local-only mode

If `askSlack.apiUrl` is empty, the extension works without Slack — just a simple InputBox prompt. No countdown, no fallback.

## Troubleshooting

### Tool doesn't appear in Copilot Chat

- Ensure VS Code >= 1.99.0
- Check the extension is activated: **Output** → **Extension Host** → look for `askSlack_askUser`
- Type `#ask_slack` in Copilot Chat to reference it explicitly

### Slack fallback not working

- Verify `askSlack.apiUrl`, `askSlack.apiKey`, `askSlack.slackUserId` are set
- Test the server: `curl http://localhost:3000/health`
- Check **Output** → **Extension Host** for error messages

### InputBox closes immediately

- `ignoreFocusOut` is set to `true` — the InputBox should persist even if you click elsewhere
- If it still closes, the agent may have cancelled the request (check cancellation token)
