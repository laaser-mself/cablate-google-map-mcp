import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";

const NAME = "maps_elevation";
const DESCRIPTION = "Get elevation data (height above sea level) for specific geographic locations";

const SCHEMA = {
  locations: z.array(z.object({
    latitude: z.number().describe("Latitude coordinate"),
    longitude: z.number().describe("Longitude coordinate"),
  })).describe("List of locations to get elevation data for"),
};

export type ElevationParams = z.infer<z.ZodObject<typeof SCHEMA>>;

async function ACTION(params: ElevationParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const result = await getSharedPlacesSearcher().getElevation(params.locations);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to retrieve elevation data" }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '),
        },
      ],
      isError: false,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return {
      isError: true,
      content: [{ type: "text", text: `Elevation data error: ${errorMessage}` }],
    };
  }
}

export const Elevation = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};