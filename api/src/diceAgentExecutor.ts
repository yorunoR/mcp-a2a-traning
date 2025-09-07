import {
  AgentExecutor,
  ExecutionEventBus,
  Message,
  RequestContext,
  Task,
  TaskStatusUpdateEvent,
} from "@a2a-js/sdk";
import { openai } from "@ai-sdk/openai";
import { generateText, tool, CoreMessage, zodSchema, stepCountIs } from "ai";

import { randomUUID } from "node:crypto";
import z from "zod";

export class DiceAgentExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();

  public cancelTask = async (
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> => {
    this.cancelledTasks.add(taskId);
  };

  // `message/send` もしくは `message/stream` イベントを受け取ったときに呼び出される
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    // `message/send` イベントでエージェントのやり取りが開始される
    // パラメーターは `RequestContext` から取得
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    // タスクとコンテキストの ID を取得
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(
      `[DiceAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`
    );

    // 新しいタスクの場合、TaskStatus が "submitted" の状態で初期化
    // "submitted" ステータスは、タスクが受け付けられたが、まだ処理が開始されていないことを示す
    if (!existingTask) {
      const initialTask: Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: "submitted",
          timestamp: new Date().toISOString(),
        },
        history: [userMessage], // 現在のユーザーメッセージから履歴を開始
        metadata: userMessage.metadata, // メッセージのメタデータがあれば継承
      };
      // eventBus.publish メソッドでクライアントにライフサイクルイベントを配信する
      eventBus.publish(initialTask);
    }

    // タスクの状態を "working" に更新
    // エージェントが処理を開始したことを示す
    const workingStatusUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: "working",
        message: {
          kind: "message",
          role: "agent",
          messageId: randomUUID(),
          parts: [
            { kind: "text", text: "Processing your question, hang tight!" },
          ],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false, // 処理がまだ完了してないことを示す
    };
    eventBus.publish(workingStatusUpdate);

    // A2A プロトコルの Message 型を Vercel AI SDK の CoreMessage 型に変換
    const messages = a2aMessageToVercelMessages(userMessage);

    // メッセージが空であればなにかがおかしいので、タスクが失敗したことを通知
    if (messages.length === 0) {
      console.warn(
        `[DiceAgentExecutor] No valid text messages found in history for task ${taskId}.`
      );
      const failureUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: randomUUID(),
            parts: [{ kind: "text", text: "No message found to process." }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true, // 失敗したタスクはこれ以上処理が行われないため、最終状態
      };
      eventBus.publish(failureUpdate);
      return;
    }

    try {
      // AI エージェントを実行
      const response = await diceRoller(messages);
      console.log(response)

      // キャンセル要求のチェック
      // タスクがキャンセルされている場合は、処理を中止
      if (this.cancelledTasks.has(taskId)) {
        console.log(
          `[DiceAgentExecutor] Request cancelled for task: ${taskId}`
        );

        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: "status-update",
          taskId: taskId,
          contextId: contextId,
          status: {
            state: "canceled",
            timestamp: new Date().toISOString(),
          },
          final: true, // キャンセルは最終状態
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      // LLM からの応答を取得
      const responseText = response.text;
      console.log(responseText)
      console.info(`[DiceAgentExecutor] Prompt response: ${responseText}`);

      // 応答を A2A プロトコルの Message 型に変換
      const agentMessage: Message = {
        kind: "message",
        role: "agent",
        messageId: randomUUID(),
        parts: [{ kind: "text", text: responseText }], // テキストコンテンツを確保
        taskId: taskId,
        contextId: contextId,
      };

      // タスクが正常に完了したことを通知
      // status を "completed" に更新
      const finalUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "completed",
          message: agentMessage,
          timestamp: new Date().toISOString(),
        },
        final: true, // 最終状態
      };
      eventBus.publish(finalUpdate);

      console.log(`[DiceAgentExecutor] Task ${taskId} finished`);
    } catch (error: any) {
      // エラーハンドリング - AI 処理中に発生した例外をキャッチ
      console.error(
        `[DiceAgentExecutor] Error processing task ${taskId}:`,
        error
      );
      const errorUpdate: TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            messageId: randomUUID(),
            parts: [{ kind: "text", text: `Agent error: ${error.message}` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }
}

// A2A プロトコルの Message 型を Vercel AI SDK の CoreMessage 型に変換する関数
const a2aMessageToVercelMessages = (a2aMessage: Message): CoreMessage[] => {
  // parts 配列からテキストコンテンツを抽出
  const textContent = a2aMessage.parts
    .filter((part) => part.kind === "text")
    .map((part) => (part as any).text)
    .join(" ");

  // A2A のロールを Vercel AI のロールにマッピング
  const role =
    a2aMessage.role === "agent" ? ("assistant" as const) : ("user" as const);

  return [
    {
      role,
      content: textContent,
    },
  ];
};

const diceRoller = (messages: CoreMessage[]) => {
  return generateText({
    model: openai("gpt-4.1-nano"),
    messages,
    tools: {
      dice: tool({
        description: "サイコロを振ってランダムな数を生成します",
        inputSchema: zodSchema(
          z.object({
          sides: z.number().optional().default(6).describe("サイコロの面の数"),
          rolls: z.number().optional().default(1).describe("振る回数"),
        })),
        execute: async ({ sides, rolls }) => {
          const results = Array.from(
            { length: rolls },
            () => Math.floor(Math.random() * sides) + 1
          );
          console.log(results)
          return results;
        },
      }),
    },
    // maxSteps: 5,
    stopWhen: stepCountIs(2),
  });
};
