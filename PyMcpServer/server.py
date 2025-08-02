from fastmcp import Context
import asyncio
import logging
import os
import json

from fastmcp import FastMCP

from clientAuth import verify_token

logger = logging.getLogger(__name__)
logging.basicConfig(format="[%(levelname)s]: %(message)s", level=logging.INFO)

mcp = FastMCP("MCP Secured Server")


@mcp.tool(
    name="get_client_metadata",
    description="Return the MCP client name and metadata."
)
async def get_client_metadata(ctx: Context) -> dict:
    """Returns the MCP client name and metadata for the current request."""

    # Safely extract client_params from session if available
    client_params = None
    if hasattr(ctx, "session") and hasattr(ctx.session, "client_params"):
        client_params = ctx.session.client_params
    if client_params is None:
        client_params = {}

    # If it's an object (InitializeRequestParams), use attribute access
    protocol_version = getattr(client_params, "protocolVersion", None)
    capabilities = getattr(client_params, "capabilities", {})
    client_info = getattr(client_params, "clientInfo", {})
    client_auth = getattr(client_info, "clientAuth", None)
    client_id = getattr(client_info, "clientId", None)

    if client_auth is not None:
        payload = verify_token(client_auth)
        if payload is None:
            logger.error("❌ Authentication failed, returning error.")
            return {"error": "Authentication failed"}
        logger.info(f"✅ Authenticated: {payload}")
        sub = payload.get("sub", "Unknown subject")
        logger.info(f"<<<  Authenticated subject: {sub}")
        if sub != client_id:
            logger.warning(f"Client ID mismatch: {sub} != {client_id}")
            return {"error": "Client ID mismatch"}

    logger.info(f"<<<  Protocol version: {protocol_version}")
    logger.info(f"<<<  Client capabilities: {capabilities}")
    logger.info(f"<<<  Client info: {client_info}")
    logger.info(f"<<<  Client auth: {client_auth}")
    logger.info(f"<<<  Client ID: {client_id}")

    ctx_serializable = {
        "client_id": ctx.client_id,
        "request_id": ctx.request_id,
        "session_id": getattr(ctx, "session_id", None),
        "client_params": client_params,
    }
    return {
        "ctx": ctx_serializable,
        "client_id": ctx.client_id or "Unknown client",
        "request_id": ctx.request_id,
    }


if __name__ == "__main__":
    logger.info(f" MCP server started on port {os.getenv('PORT', 8080)}")
    asyncio.run(
        mcp.run_async(
            transport="streamable-http",
            host="0.0.0.0",
            port=os.getenv("PORT", 8080),
        )
    )
