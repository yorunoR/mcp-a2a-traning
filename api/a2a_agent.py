import asyncio
from typing import Any

from a2a.types import AgentCard, AgentProvider, AgentCapabilities, Message, TextPart
from a2a.server.agent_execution.agent_executor import AgentExecutor
from a2a.server.agent_execution.context import RequestContext
from a2a.server.events.in_memory_queue_manager import InMemoryQueueManager
from a2a.server.events.event_queue import EventQueue
from a2a.server.request_handlers.default_request_handler import DefaultRequestHandler
from a2a.server.tasks.inmemory_task_store import InMemoryTaskStore
from a2a.server.apps import A2AFastAPIApplication

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


# --- 1) もっとも単純な Executor 実装 ---
class MinimalExecutor(AgentExecutor):
    """ユーザーの入力を取り出して MCP ツール ask_llm に投げ、その結果を Message で返すだけ"""

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        # 今回はシンプルなのでキャンセル処理は何もしない
        return

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        # ユーザーからのテキスト入力をまとめて取得
        user_text = context.get_user_input()
        if not user_text:
            user_text = "Say hello from A2A via MCP."

        # --- MCP サーバープロセスを stdio で起動してツール呼び出し ---
        # ここではローカルの mcp_server.py を子プロセスとして実行
        params = StdioServerParameters(
            command="python",
            args=["mcp_server.py"],
        )

        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                # 最小：ツール 'ask_llm' を呼ぶ
                result = await session.call_tool(
                    "ask_llm",
                    arguments={"prompt": user_text, "model": "gpt-4o-mini"},
                )

        # MCP の result（構造化/非構造化いずれでも）を文字列へ
        if isinstance(result, dict) and "result" in result:
            body = result["result"]
        else:
            body = str(result)

        # A2A の Message を publish（最終結果として 1 つだけ出す）
        msg = Message.create_assistant_message(parts=[TextPart(text=body)])
        await event_queue.enqueue_event(msg)
        await event_queue.close()


# --- 2) A2A サーバー（FastAPI アプリ生成） ---
def build_app():
    # 最小の AgentCard（クライアント側が /.well-known/agent-card.json を叩いたときに返る自己記述）
    card = AgentCard(
        name="a2a-mcp-minimal",
        version="0.1.0",
        description="Minimal A2A server that calls an MCP tool (ask_llm).",
        provider=AgentProvider(url="http://localhost:8000", organization="examples"),
        capabilities=AgentCapabilities(streaming=False),
    )

    # インメモリ実装で十分（最小構成）
    task_store = InMemoryTaskStore()
    queue_mgr = InMemoryQueueManager()
    executor = MinimalExecutor()
    handler = DefaultRequestHandler(
        agent_executor=executor,
        task_store=task_store,
        queue_manager=queue_mgr,
    )

    # FastAPI アプリに A2A の JSON-RPC エンドポイントとエージェントカードを生やす
    app = A2AFastAPIApplication(agent_card=card, http_handler=handler).build()
    return app


app = build_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("a2a_server:app", host="0.0.0.0", port=8000, reload=False)
