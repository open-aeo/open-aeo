#!/usr/bin/env node
import { AeoMcpServer } from "./mcp/server.js";
import { execSync } from "child_process";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import ora from "ora";

function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA ?? "", "Claude", "claude_desktop_config.json");
    case "linux":
      return path.join(os.homedir(), ".config", "Claude", "claude_desktop_config.json");
    default:
      return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function printBanner() {
  console.log();
  console.log(chalk.bold.cyan("  open-aeo") + chalk.dim("  AEO citation monitor for Claude"));
  console.log(chalk.dim("  ─────────────────────────────────────"));
  console.log();
}

async function install() {
  printBanner();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const apiKey = await ask(rl, chalk.bold("  Perplexity API key: "));
  if (!apiKey) {
    console.error(chalk.red("  Error: API key cannot be empty."));
    rl.close();
    process.exit(1);
  }

  console.log();
  console.log(chalk.dim("  Where would you like to install?"));
  console.log(chalk.dim("  1) Claude Code  2) Claude Desktop  3) Both"));
  const client = await ask(rl, chalk.bold("  Choice [default: 1]: "));
  rl.close();
  console.log();

  const choice = client === "" ? "1" : client;
  const installClaudeCode = choice === "1" || choice === "3";
  const installDesktop = choice === "2" || choice === "3";

  if (installClaudeCode) {
    const spinner = ora({ text: "Registering with Claude Code…", color: "cyan" }).start();
    try {
      execSync(
        `claude mcp add open-aeo -e PERPLEXITY_API_KEY=${apiKey} -- npx -y open-aeo`,
        { stdio: "pipe" },
      );
      spinner.succeed(chalk.green("Registered with Claude Code"));
    } catch {
      spinner.fail(chalk.red("Failed to register with Claude Code — is the Claude CLI installed?"));
    }
  }

  if (installDesktop) {
    const configPath = getClaudeDesktopConfigPath();
    const spinner = ora({ text: "Writing Claude Desktop config…", color: "cyan" }).start();

    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch {
        spinner.fail(chalk.red(`Could not parse config at ${configPath} — check it for JSON errors.`));
        process.exit(1);
      }
    }

    if (!config.mcpServers || typeof config.mcpServers !== "object") {
      config.mcpServers = {};
    }

    (config.mcpServers as Record<string, unknown>)["open-aeo"] = {
      command: "npx",
      args: ["-y", "open-aeo"],
      env: { PERPLEXITY_API_KEY: apiKey },
    };

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    spinner.succeed(chalk.green("Written to Claude Desktop config"));
  }

  console.log();
  console.log(chalk.bold.green("  All done!") + chalk.dim(" Restart Claude to apply the changes."));
  console.log(chalk.dim("  Then ask: \"What MCP tools do you have available?\""));
  console.log();
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
