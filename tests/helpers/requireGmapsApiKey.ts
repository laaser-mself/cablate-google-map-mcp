import dotenv from "dotenv";
import readline from "node:readline/promises";
import { stdin as input, stderr as output } from "node:process";

dotenv.config();

export async function requireGmapsApiKey(): Promise<string> {
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
