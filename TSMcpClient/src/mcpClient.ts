import { MCPClient } from "mcp-client";
import crypto from "crypto";
import { authenticateClient } from "./clientAuth";

const clientId = "com.lirons.clt1";

const client = new MCPClient({
  name: "claude-ai",
  version: "1.0.0",
  //@ts-ignore
  clientAuth: authToken, // Use auth token if required
  clientId: clientId,
});

export async function mainClt() {
  const jwt = await authenticateClient(clientId, "private.pem");
  console.log("JWT for client authentication:", jwt);
  const client = new MCPClient({
    name: "claude-ai",
    version: "1.0.0",
    //@ts-ignore
    clientAuth: jwt,
    clientId: clientId,
  });

  // Connect to the MCP server
  await client.connect({
    type: "httpStream",
    url: "http://localhost:8080/mcp",
  });

  console.log("Connected to MCP server");
  // Get all available tools
  const tools = await client.getAllTools();
  console.log("Available tools:", JSON.stringify(tools, null, 2));

  if (!tools || tools.length === 0) {
    console.log("No tools available on the MCP server.");
    return;
  }

  // Try to invoke each tool with sample arguments
  for (const tool of tools) {
    try {
      // Print tool details for debugging
      console.log(`Invoking tool: ${tool.name}`);
      console.log("Tool details:", JSON.stringify(tool, null, 2));
      // You must provide valid arguments for each tool
      // For now, use empty object and print error if it fails
      const result = await client.callTool({
        name: tool.name,
        arguments: {},
      });
      // Try to parse the 'text' field in the result as JSON
      let printed = false;
      if (
        result &&
        result.content &&
        Array.isArray(result.content) &&
        result.content[0]?.type === "text" &&
        typeof result.content[0].text === "string"
      ) {
        try {
          const parsed = JSON.parse(result.content[0].text);
          console.log(
            `Result for ${tool.name}:`,
            JSON.stringify(parsed, null, 2)
          );
          printed = true;
        } catch (e) {
          // If parsing fails, print raw text
          console.log(
            `Result for ${tool.name} (raw text):`,
            result.content[0].text
          );
          printed = true;
        }
      }
      if (!printed) {
        console.log(
          `Result for ${tool.name}:`,
          JSON.stringify(result, null, 2)
        );
      }
    } catch (err) {
      console.error(`Error invoking ${tool.name}:`, err);
    }
  }
}
