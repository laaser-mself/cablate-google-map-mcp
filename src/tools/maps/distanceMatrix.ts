import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";
import { avoidSchema, commonMapsParams, trafficModelSchema, travelModeSchema, unitsSchema } from "./commonSchema.js";

const NAME = "maps_distance_matrix";
const DESCRIPTION = "Calculate travel distances and durations between multiple origins and destinations for different travel modes";

const SCHEMA = {
  origins: z.array(z.string()).describe("List of origin addresses or coordinates"),
  destinations: z.array(z.string()).describe("List of destination addresses or coordinates"),
  mode: travelModeSchema.describe("Travel mode for calculation"),
  departureTime: z.string().optional().describe("ISO departure time for traffic-aware driving estimates"),
  arrivalTime: z.string().optional().describe("ISO arrival time (transit); mutually exclusive with departureTime"),
  trafficModel: trafficModelSchema.describe("Traffic model when departureTime is set"),
  avoid: avoidSchema.describe("Features to avoid"),
  units: unitsSchema.describe("Distance unit system"),
  transitMode: z.array(z.string()).optional().describe("Preferred transit modes"),
  transitRoutingPreference: z.string().optional().describe("Transit routing preference"),
  ...commonMapsParams,
};

export const DistanceMatrixSchema = z.object(SCHEMA).superRefine((value, ctx) => {
  if (value.departureTime && value.arrivalTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "departureTime and arrivalTime cannot both be set" });
  }
});

export type DistanceMatrixParams = z.infer<typeof DistanceMatrixSchema>;

async function ACTION(params: DistanceMatrixParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = DistanceMatrixSchema.parse(params);
    const result = await getSharedPlacesSearcher().calculateDistanceMatrix(
      parsed.origins,
      parsed.destinations,
      parsed.mode,
      parsed
    );
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const DistanceMatrix = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
