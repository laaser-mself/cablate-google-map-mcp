import { z } from "zod";

export const commonMapsParams = {
  language: z.string().optional().describe("BCP-47 language code; default en"),
  region: z.string().optional().describe("ccTLD region bias, e.g. us"),
};

export const travelModeSchema = z.enum(["driving", "walking", "bicycling", "transit"]).default("driving");

export const avoidSchema = z.array(z.enum(["tolls", "highways", "ferries", "indoor"])).optional();

export const trafficModelSchema = z.enum(["best_guess", "pessimistic", "optimistic"]).optional();

export const unitsSchema = z.enum(["metric", "imperial"]).optional();
