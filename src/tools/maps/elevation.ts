import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";

const NAME = "maps_elevation";
const DESCRIPTION = "Get elevation data (height above sea level) for specific geographic locations, or sample a path";

const SCHEMA = {
  locations: z.array(z.object({
    latitude: z.number().describe("Latitude coordinate"),
    longitude: z.number().describe("Longitude coordinate"),
  })).optional().describe("List of locations to get elevation data for"),
  path: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
  })).optional().describe("Path to sample; requires samples"),
  samples: z.number().int().positive().optional().describe("Number of samples along path"),
};

export const ElevationSchema = z.object(SCHEMA).superRefine((value, ctx) => {
  const hasLocations = !!(value.locations && value.locations.length > 0);
  const hasPath = !!(value.path && value.path.length > 0 && value.samples);
  if (hasLocations === hasPath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one of locations or (path + samples)",
    });
  }
});

export type ElevationParams = z.infer<typeof ElevationSchema>;

async function ACTION(params: ElevationParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = ElevationSchema.parse(params);
    const result = await getSharedPlacesSearcher().getElevation(parsed);
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const Elevation = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
