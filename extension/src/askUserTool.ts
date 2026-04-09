import * as vscode from "vscode";
import { AskSlackConfig, askViaSlackApi } from "./slackApiClient";

interface QuestionOption {
  label: string;
  description?: string;
  recommended?: boolean;
}

interface AskUserInput {
  question: string;
  context?: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  allowFreeformInput?: boolean;
}

interface IQuestionAnswer {
  selected: string[];
  freeText: string | null;
  skipped: boolean;
}

interface IAnswerResult {
  answers: Record<string, IQuestionAnswer>;
}

const API_KEY_SECRET = "askSlack.apiKey";

export async function getConfig(
  secrets: vscode.SecretStorage,
): Promise<AskSlackConfig & { awayMode: boolean }> {
  const cfg = vscode.workspace.getConfiguration("askSlack");
  const apiKey = (await secrets.get(API_KEY_SECRET)) ?? "";
  return {
    timeoutSeconds: cfg.get<number>("timeoutSeconds", 60),
    awayMode: cfg.get<boolean>("awayMode", false),
    apiUrl: cfg.get<string>("apiUrl", ""),
    apiKey,
    slackUserId: cfg.get<string>("slackUserId", ""),
  };
}

export class AskUserTool implements vscode.LanguageModelTool<AskUserInput> {
  constructor(private readonly _secrets: vscode.SecretStorage) {}

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AskUserInput>,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Asking: "${options.input.question}"`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AskUserInput>,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { question, context, options: questionOptions, multiSelect, allowFreeformInput } = options.input;
    const config = await getConfig(this._secrets);
    const slackConfigured = !!(
      config.apiUrl &&
      config.apiKey &&
      config.slackUserId
    );

    const answer = await this.askWithFallback(
      question,
      context,
      questionOptions,
      multiSelect,
      allowFreeformInput,
      config,
      slackConfigured,
      config.awayMode,
      options.toolInvocationToken,
      token,
    );

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(answer),
    ]);
  }

  /**
   * Shows the native inline question carousel (same UI as vscode_askQuestions).
   * If the user does not respond within `config.timeoutSeconds`, the question
   * is forwarded to Slack DM. The first answer (local OR Slack) wins.
   */
  private askWithFallback(
    question: string,
    context: string | undefined,
    options: QuestionOption[] | undefined,
    multiSelect: boolean | undefined,
    allowFreeformInput: boolean | undefined,
    config: AskSlackConfig,
    slackConfigured: boolean,
    awayMode: boolean,
    toolInvocationToken: vscode.ChatParticipantToolToken | undefined,
    token: vscode.CancellationToken,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      let slackPending: Promise<string> | undefined;
      let slackTimer: ReturnType<typeof setTimeout> | undefined;

      const carouselCts = new vscode.CancellationTokenSource();
      token.onCancellationRequested(() => carouselCts.cancel());

      const finish = (answer: string, source: "local" | "slack") => {
        if (resolved) return;
        resolved = true;
        if (slackTimer) clearTimeout(slackTimer);
        carouselCts.cancel();
        carouselCts.dispose();
        resolve(
          source === "slack" ? `[answered via Slack] ${answer}` : answer,
        );
      };

      const failWith = (err: Error) => {
        if (resolved) return;
        resolved = true;
        if (slackTimer) clearTimeout(slackTimer);
        carouselCts.cancel();
        carouselCts.dispose();
        reject(err);
      };

      const sendToSlack = () => {
        if (slackPending || resolved) return;

        const statusMsg = vscode.window.setStatusBarMessage(
          "$(sync~spin) Question sent to Slack, waiting for reply...",
        );

        slackPending = askViaSlackApi(config, question, context);
        slackPending
          .then((answer) => finish(answer, "slack"))
          .catch((err: unknown) => {
            statusMsg.dispose();
            const message =
              err instanceof Error ? err.message : String(err);
            if (!resolved) {
              vscode.window.showWarningMessage(
                `Slack error: ${message}. Please answer in the chat UI.`,
              );
            }
          })
          .finally(() => statusMsg.dispose());
      };

      // Away mode: skip local UI entirely, send straight to Slack
      if (awayMode && slackConfigured) {
        sendToSlack();
        return;
      }

      // Build the question carousel input
      const questionText = context
        ? `Context: ${context}\n\n${question}`
        : question;

      const timeoutNote = slackConfigured
        ? `\n\n_If no answer within ${config.timeoutSeconds}s, this will be sent to Slack._`
        : "";

      // Map options to the format vscode_askQuestions expects
      const questionOptions = options?.map((o, i) => ({
        id: String(i),
        label: o.label,
        description: o.description,
        recommended: o.recommended,
      }));

      // Determine question type: multiSelect > singleSelect > text
      // allowFreeformInput defaults to true when no options are provided
      const hasOptions = questionOptions && questionOptions.length > 0;
      const freeform = allowFreeformInput ?? !hasOptions;

      // Show inline question carousel (same UI as built-in vscode_askQuestions)
      Promise.resolve(
        vscode.lm.invokeTool(
          "vscode_askQuestions",
          {
            input: {
              questions: [
                {
                  header: "Question from Agent",
                  question: questionText + timeoutNote,
                  options: questionOptions,
                  multiSelect: multiSelect ?? false,
                  allowFreeformInput: freeform,
                },
              ],
            },
            toolInvocationToken,
          },
          carouselCts.token,
        ),
      )
        .then((result) => {
          if (resolved) return;

          const firstPart = result.content[0];
          if (
            firstPart instanceof vscode.LanguageModelTextPart &&
            firstPart.value
          ) {
            const parsed = JSON.parse(firstPart.value) as IAnswerResult;
            const key = Object.keys(parsed.answers)[0];
            const answer = parsed.answers[key];

            if (answer.skipped) {
              // User skipped — send to Slack immediately if configured
              if (slackConfigured) {
                sendToSlack();
              } else {
                failWith(
                  new Error(
                    "Question skipped and Slack is not configured",
                  ),
                );
              }
              return;
            }

            const text =
              answer.freeText || answer.selected.join(", ") || "";
            if (text) {
              finish(text, "local");
            } else if (slackConfigured) {
              sendToSlack();
            } else {
              failWith(new Error("Empty answer and Slack not configured"));
            }
          }
        })
        .catch((err: unknown) => {
          // CancellationError means Slack won the race — not an error
          if (resolved) return;
          if (err instanceof vscode.CancellationError) return;
          failWith(
            err instanceof Error ? err : new Error(String(err)),
          );
        });

      // Slack fallback timer
      if (slackConfigured) {
        slackTimer = setTimeout(() => {
          sendToSlack();
        }, config.timeoutSeconds * 1000);
      }

      // Parent cancellation
      token.onCancellationRequested(() => {
        failWith(new vscode.CancellationError());
      });
    });
  }
}
