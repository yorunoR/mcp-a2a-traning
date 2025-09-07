import {
  TaskStore,
  AgentExecutor,
} from "@a2a-js/sdk";
import { DiceAgentExecutor } from "./diceAgentExecutor";
import { agentCard } from "./agentCard";
import express from "express";
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
} from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";

// TaskStore を作成
const taskStore: TaskStore = new InMemoryTaskStore();

const agentExecutor: AgentExecutor = new DiceAgentExecutor();

const requestHandler = new DefaultRequestHandler(
  agentCard,
  taskStore,
  agentExecutor
);

// A2AExpressApp を使用して Express アプリケーションをセットアップ
const appBuilder = new A2AExpressApp(requestHandler);
const expressApp = appBuilder.setupRoutes(express());

const PORT = process.env.PORT || 41241;
expressApp.listen(PORT, () => {
  console.log(`A2A server is running on http://localhost:${PORT}`);
});
