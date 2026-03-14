import { AeoMcpServer } from "./mcp/server.js";

async function main() {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.error(
      "FATAL ERROR: PERPLEXITY_API_KEY environment variable is missing.",
    );
    console.error(
      "Please set it in your environment or Claude Desktop config.",
    );
    process.exit(1);
  }

  try {
    const server = new AeoMcpServer(apiKey);

    await server.run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("FATAL ERROR: Failed to start OpenAEO MCP Server", message);
    process.exit(1);
  }
}

main();
