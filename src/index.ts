#!/usr/bin/env node
import { AeoMcpServer } from "./mcp/server.js";
import { execSync } from "child_process";
import * as readline from "readline";

async function install() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const apiKey = await new Promise<string>((resolve) => {
    rl.question("Enter your Perplexity API key: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!apiKey) {
    console.error("Error: API key cannot be empty.");
    process.exit(1);
  }

  try {
    execSync(
      `claude mcp add open-aeo -e PERPLEXITY_API_KEY=${apiKey} -- npx -y open-aeo`,
      { stdio: "inherit" },
    );
    console.log("\nopen-aeo MCP server installed successfully.");
    console.log('Restart Claude Code for the changes to take effect.');
  } catch {
    console.error("Error: Failed to run `claude mcp add`. Make sure Claude Code CLI is installed.");
    process.exit(1);
  }
}

async function main() {
  if (process.argv[2] === "install") {
    await install();
    return;
  }

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
