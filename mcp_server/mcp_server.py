import logging
from fastmcp import FastMCP

logging.basicConfig(level=logging.INFO)
mcp = FastMCP("Minimal MCP")

@mcp.tool()
def echo(text: str) -> str:
    return text

if __name__ == "__main__":
    # 標準入出力(Claude Desktop 等)でも、HTTP でも動かせます
    # デフォルトは stdio。HTTP で動かすなら:
    #   UVICORN_CMD: uvicorn mcp_server:mcp.http_app --host 0.0.0.0 --port 8080
    mcp.run()  # stdio
