#!/usr/bin/env node
import dotenv from "dotenv";
import readline from "node:readline/promises";
import { stdin as input, stderr as output } from "node:process";
import { spawn } from "node:child_process";

dotenv.config();

async function requireGmapsApiKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return process.env.GOOGLE_MAPS_API_KEY;
  }
  if (process.env.CI === "true") {
    throw new Error("GOOGLE_MAPS_API_KEY is required for integration tests (CI=true, prompt skipped)");
  }
  output.write("Google Maps API key required for integration tests.\n");
  output.write("Set GOOGLE_MAPS_API_KEY in the environment or .env, or paste it now.\n");
  const rl = readline.createInterface({ input, output });
  const key = (await rl.question("Enter GOOGLE_MAPS_API_KEY: ")).trim();
  rl.close();
  if (!key) {
    throw new Error("No Google Maps API key provided");
  }
  process.env.GOOGLE_MAPS_API_KEY = key;
  return key;
}

try {
  await requireGmapsApiKey();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--experimental-vm-modules", "./node_modules/jest/bin/jest.js", "--config", "jest.integration.config.mjs"],
  {
    stdio: "inherit",
    env: process.env,
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
