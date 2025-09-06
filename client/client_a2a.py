import httpx
import asyncio

A2A_URL = "http://localhost:10000"

async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        # A2A の send エンドポイント（最小形）
        r = await client.post(
            f"{A2A_URL}/send",
            json={
                "input": {"type": "text", "text": "こんにちは A2A + MCP!"},
                "stream": False,
            },
        )
        r.raise_for_status()
        print("A2A response:", r.json())

if __name__ == "__main__":
    asyncio.run(main())
