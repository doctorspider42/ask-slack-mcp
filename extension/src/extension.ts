import * as vscode from "vscode";
import { AskUserTool } from "./askUserTool";
import { SettingsPanel } from "./settingsPanel";

export function activate(context: vscode.ExtensionContext) {
  const tool = new AskUserTool(context.secrets);
  context.subscriptions.push(vscode.lm.registerTool("askSlack_askUser", tool));

  context.subscriptions.push(
    vscode.commands.registerCommand("askSlack.openSettings", () => {
      SettingsPanel.show(context.extensionUri, context.secrets);
    }),
  );
}

export function deactivate() {}
