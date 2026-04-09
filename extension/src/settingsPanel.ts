import * as vscode from "vscode";

const API_KEY_SECRET = "askSlack.apiKey";

export class SettingsPanel {
  public static readonly viewType = "askSlack.settingsPanel";
  private static currentPanel: SettingsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _secrets: vscode.SecretStorage;
  private _disposables: vscode.Disposable[] = [];

  public static show(extensionUri: vscode.Uri, secrets: vscode.SecretStorage) {
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      SettingsPanel.viewType,
      "Ask Slack — Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri, secrets);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    secrets: vscode.SecretStorage,
  ) {
    this._panel = panel;
    this._secrets = secrets;
    this._panel.webview.html = this.getHtml();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (msg: { type: string; key?: string; value?: unknown }) => {
        if (msg.type === "save") {
          if (msg.key === "apiKey") {
            // Store API key in OS keychain via SecretStorage
            const value = String(msg.value ?? "");
            if (value) {
              await this._secrets.store(API_KEY_SECRET, value);
            } else {
              await this._secrets.delete(API_KEY_SECRET);
            }
          } else if (msg.key) {
            const cfg = vscode.workspace.getConfiguration("askSlack");
            await cfg.update(
              msg.key,
              msg.value,
              vscode.ConfigurationTarget.Global,
            );
          }
        } else if (msg.type === "load") {
          const cfg = vscode.workspace.getConfiguration("askSlack");
          const apiKey = (await this._secrets.get(API_KEY_SECRET)) ?? "";
          this._panel.webview.postMessage({
            type: "settings",
            values: {
              apiUrl: cfg.get<string>("apiUrl", ""),
              apiKey,
              slackUserId: cfg.get<string>("slackUserId", ""),
              timeoutSeconds: cfg.get<number>("timeoutSeconds", 60),
              awayMode: cfg.get<boolean>("awayMode", false),
            },
          });
        } else if (msg.type === "test") {
          await this.testConnection();
        }
      },
      null,
      this._disposables,
    );
  }

  private async testConnection() {
    const cfg = vscode.workspace.getConfiguration("askSlack");
    const apiUrl = cfg.get<string>("apiUrl", "");
    if (!apiUrl) {
      this._panel.webview.postMessage({
        type: "testResult",
        success: false,
        message: "API URL is not configured",
      });
      return;
    }

    try {
      const resp = await fetch(`${apiUrl}/health`);
      if (resp.ok) {
        const data = (await resp.json()) as { status: string; version: string };
        this._panel.webview.postMessage({
          type: "testResult",
          success: true,
          message: `Connected! Server v${data.version} — status: ${data.status}`,
        });
      } else {
        this._panel.webview.postMessage({
          type: "testResult",
          success: false,
          message: `Server returned HTTP ${resp.status}`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this._panel.webview.postMessage({
        type: "testResult",
        success: false,
        message: `Connection failed: ${message}`,
      });
    }
  }

  private dispose() {
    SettingsPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  private getHtml(): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ask Slack Settings</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border, #3c3c3c);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --btn-secondary-bg: var(--vscode-button-secondaryBackground);
    --btn-secondary-fg: var(--vscode-button-secondaryForeground);
    --btn-secondary-hover: var(--vscode-button-secondaryHoverBackground);
    --focus-border: var(--vscode-focusBorder);
    --success: var(--vscode-testing-iconPassed, #73c991);
    --error: var(--vscode-testing-iconFailed, #f48771);
    --description: var(--vscode-descriptionForeground);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, system-ui);
    font-size: var(--vscode-font-size, 13px);
    color: var(--fg);
    background: var(--bg);
    padding: 24px 32px;
    max-width: 640px;
  }

  h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .subtitle {
    color: var(--description);
    margin-bottom: 24px;
    font-size: 12px;
  }

  .section {
    margin-bottom: 24px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    padding: 16px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field {
    margin-bottom: 14px;
  }
  .field:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .field-desc {
    color: var(--description);
    font-size: 11px;
    margin-bottom: 4px;
  }

  input[type="text"],
  input[type="password"],
  input[type="number"] {
    width: 100%;
    padding: 6px 8px;
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    border-radius: 3px;
    font-size: 13px;
    font-family: var(--vscode-editor-font-family, monospace);
    outline: none;
  }

  input:focus {
    border-color: var(--focus-border);
  }

  input[type="number"] {
    width: 100px;
  }

  .btn-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  button {
    padding: 6px 14px;
    border: none;
    border-radius: 3px;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .btn-primary {
    background: var(--btn-bg);
    color: var(--btn-fg);
  }
  .btn-primary:hover { background: var(--btn-hover); }

  .btn-secondary {
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-fg);
  }
  .btn-secondary:hover { background: var(--btn-secondary-hover); }

  .status-bar {
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    display: none;
  }
  .status-bar.success {
    display: block;
    background: color-mix(in srgb, var(--success) 15%, transparent);
    color: var(--success);
    border: 1px solid color-mix(in srgb, var(--success) 30%, transparent);
  }
  .status-bar.error {
    display: block;
    background: color-mix(in srgb, var(--error) 15%, transparent);
    color: var(--error);
    border: 1px solid color-mix(in srgb, var(--error) 30%, transparent);
  }

  .saved-indicator {
    color: var(--success);
    font-size: 11px;
    opacity: 0;
    transition: opacity 0.3s;
    margin-left: 8px;
  }
  .saved-indicator.show {
    opacity: 1;
  }

  .toggle-password {
    background: none;
    border: none;
    color: var(--description);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 0;
    margin-top: 2px;
  }
  .toggle-password:hover { color: var(--fg); }

  .secure-badge {
    font-size: 11px;
    font-weight: 400;
    color: var(--success);
  }

  .away-mode-field {
    border: 1px solid color-mix(in srgb, var(--focus-border) 35%, transparent);
    border-radius: 4px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--focus-border) 6%, transparent);
  }

  .away-note {
    font-size: 11px;
    color: var(--description);
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 500;
    user-select: none;
  }

  .toggle-label input[type="checkbox"] {
    display: none;
  }

  .toggle-track {
    position: relative;
    width: 32px;
    height: 18px;
    background: var(--input-border);
    border-radius: 9px;
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--btn-fg, #fff);
    border-radius: 50%;
    transition: left 0.2s;
  }

  input[type="checkbox"]:checked + .toggle-track {
    background: var(--btn-bg);
  }

  input[type="checkbox"]:checked + .toggle-track .toggle-thumb {
    left: 16px;
  }

  .info-box {
    background: color-mix(in srgb, var(--focus-border) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--focus-border) 30%, transparent);
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--description);
    line-height: 1.5;
  }
</style>
</head>
<body>

<h1>Ask Slack</h1>
<p class="subtitle">Configure the Slack fallback for human-in-the-loop questions</p>

<div class="section">
  <div class="section-title">Server Connection</div>

  <div class="field">
    <label for="apiUrl">API URL</label>
    <div class="field-desc">Base URL of the ask-slack-mcp server (e.g. http://localhost:3000)</div>
    <input type="text" id="apiUrl" placeholder="http://localhost:3000" data-key="apiUrl">
  </div>

  <div class="field">
    <label for="apiKey">API Key <span class="secure-badge">&#x1f512; stored securely</span></label>
    <div class="field-desc">Shared secret for authenticating with the server — stored in your OS keychain</div>
    <input type="password" id="apiKey" placeholder="your-api-key" data-key="apiKey">
    <button class="toggle-password" onclick="togglePassword('apiKey')">Show</button>
  </div>

  <div class="btn-row">
    <button class="btn-secondary" onclick="testConnection()">Test Connection</button>
  </div>

  <div class="status-bar" id="testStatus"></div>
</div>

<div class="section">
  <div class="section-title">Slack User</div>

  <div class="field">
    <label for="slackUserId">Slack User ID</label>
    <div class="field-desc">Your Slack member ID — click your profile → ⋯ → Copy member ID</div>
    <input type="text" id="slackUserId" placeholder="U01XXXXXXX" data-key="slackUserId">
  </div>
</div>

<div class="section">
  <div class="section-title">Behavior</div>

  <div class="field away-mode-field">
    <div class="away-note">Enable this when you're away from VS Code. Questions will skip the local prompt and go directly to Slack — the timeout setting below is preserved and will be used again once you turn this off.</div>
    <label class="toggle-label">
      <input type="checkbox" id="awayMode" data-key="awayMode" data-type="boolean">
      <span class="toggle-track"><span class="toggle-thumb"></span></span>
      Away mode — send questions directly to Slack
    </label>
  </div>

  <div class="field">
    <label for="timeoutSeconds">Timeout (seconds)</label>
    <div class="field-desc">How long to wait for a local answer before sending to Slack</div>
    <input type="number" id="timeoutSeconds" min="5" max="600" data-key="timeoutSeconds">
  </div>
</div>

<div class="info-box">
  <strong>How it works:</strong> When an agent asks a question, an inline prompt appears in the chat.
  If you don't respond within the timeout, the question is forwarded to your Slack DM.
  The first answer — local or Slack — wins.<br><br>
  If API URL, API Key, or Slack User ID are empty, the tool works in <strong>local-only mode</strong> — no Slack fallback.
</div>

<script>
  const vscode = acquireVsCodeApi();
  let saveTimers = {};

  // Load settings on startup
  vscode.postMessage({ type: 'load' });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'settings') {
      for (const [key, value] of Object.entries(msg.values)) {
        const el = document.getElementById(key);
        if (!el) continue;
        if (el.type === 'checkbox') {
          el.checked = !!value;
        } else {
          el.value = value;
        }
      }
    } else if (msg.type === 'testResult') {
      const status = document.getElementById('testStatus');
      status.textContent = msg.message;
      status.className = 'status-bar ' + (msg.success ? 'success' : 'error');
    }
  });

  // Auto-save on change with debounce
  document.querySelectorAll('input[data-key]').forEach((input) => {
    const eventName = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      const key = input.dataset.key;
      clearTimeout(saveTimers[key]);
      const delay = input.type === 'checkbox' ? 0 : 500;
      saveTimers[key] = setTimeout(() => {
        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
        } else if (input.type === 'number') {
          value = parseInt(input.value, 10) || 60;
        } else {
          value = input.value;
        }
        vscode.postMessage({ type: 'save', key, value });
        showSaved(input.closest('.field') || input.parentElement);
      }, delay);
    });
  });

  function showSaved(container) {
    let indicator = container.querySelector('.saved-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'saved-indicator';
      indicator.textContent = '✓ Saved';
      container.appendChild(indicator);
    }
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 1500);
  }

  function togglePassword(id) {
    const input = document.getElementById(id);
    const btn = input.nextElementSibling;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  }

  function testConnection() {
    const status = document.getElementById('testStatus');
    status.textContent = 'Testing...';
    status.className = 'status-bar success';
    status.style.display = 'block';
    vscode.postMessage({ type: 'test' });
  }
</script>

</body>
</html>`;
  }
}
