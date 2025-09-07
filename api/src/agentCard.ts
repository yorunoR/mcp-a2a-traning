import type { AgentCard } from "@a2a-js/sdk";

export const agentCard: AgentCard = {
  name: "Dice Agent",
  description: "サイコロを振るエージェント",
  // A2A サーバーを実行しているホストの URL
  url: "http://localhost:41241",
  provider: {
    organization: "Dice Organization",
    url: "https://example.com/dice-org",
  },
  version: "0.1.0",
  capabilities: {
    // ストリーミングをサポートしているかどうか
    streaming: true,
    // push 通知をサポートしているかどうか
    pushNotifications: false,
    // agent が履歴を保持しているかどうか
    stateTransitionHistory: true,
  },
  security: undefined,
  securitySchemes: undefined,
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  // エージェントが持つ専門的なスキルの定義
  skills: [
    {
      id: "rollDice",
      name: "rollDice",
      description: "サイコロを振った結果を返す",
      // プロンプトの例
      examples: [
        "ランダムな数字を生成してください",
        "カタンをプレイするので、サイコロを振ってください",
        "麻雀で親を決めるためにサイコロを振ってください",
      ],
      tags: ["dice", "random", "game"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain"],
    },
  ],
};
