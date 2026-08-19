import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";
import { avoidSchema, commonMapsParams, trafficModelSchema, travelModeSchema, unitsSchema } from "./commonSchema.js";

const NAME = "maps_directions";
const DESCRIPTION = "Get turn-by-turn directions between two locations. departureTime is optional and is not defaulted to now; omit it unless traffic-aware routing is required.";

const SCHEMA = {
  origin: z.string().describe("Starting point address or coordinates"),
  destination: z.string().describe("Destination address or coordinates"),
  mode: travelModeSchema.describe("Travel mode for directions"),
  waypoints: z.array(z.string()).optional().describe("Intermediate waypoints"),
  alternatives: z.boolean().optional().describe("Request alternate routes"),
  optimizeWaypoints: z.boolean().optional().describe("Optimize waypoint order"),
  avoid: avoidSchema.describe("Features to avoid"),
  departureTime: z.string().optional().describe("ISO departure time; omit unless traffic-aware routing is needed"),
  arrivalTime: z.string().optional().describe("ISO arrival time (transit); mutually exclusive with departureTime"),
  trafficModel: trafficModelSchema.describe("Traffic model when departureTime is set"),
  units: unitsSchema.describe("Distance unit system"),
  transitMode: z.array(z.string()).optional().describe("Preferred transit modes"),
  transitRoutingPreference: z.string().optional().describe("Transit routing preference"),
  departure_time: z.string().optional().describe("Legacy alias for departureTime"),
  arrival_time: z.string().optional().describe("Legacy alias for arrivalTime"),
  ...commonMapsParams,
};

export const DirectionsSchema = z.object(SCHEMA).superRefine((value, ctx) => {
  const departure = value.departureTime || value.departure_time;
  const arrival = value.arrivalTime || value.arrival_time;
  if (departure && arrival) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "departureTime and arrivalTime cannot both be set" });
  }
});

export type DirectionsParams = z.infer<typeof DirectionsSchema>;

async function ACTION(params: DirectionsParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = DirectionsSchema.parse(params);
    const result = await getSharedPlacesSearcher().getDirections(parsed.origin, parsed.destination, parsed.mode, {
      ...parsed,
      departureTime: parsed.departureTime || parsed.departure_time,
      arrivalTime: parsed.arrivalTime || parsed.arrival_time,
    });
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const Directions = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
