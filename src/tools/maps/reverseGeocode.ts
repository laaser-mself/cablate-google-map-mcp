import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";

const NAME = "maps_reverse_geocode";
const DESCRIPTION = "Convert geographic coordinates (latitude and longitude) to a human-readable address";

const SCHEMA = {
  latitude: z.number().describe("Latitude coordinate"),
  longitude: z.number().describe("Longitude coordinate"),
};

export type ReverseGeocodeParams = z.infer<z.ZodObject<typeof SCHEMA>>;

async function ACTION(params: ReverseGeocodeParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const result = await getSharedPlacesSearcher().reverseGeocode(params.latitude, params.longitude);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Reverse geocoding failed" }],
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
      content: [{ type: "text", text: `Reverse geocoding error: ${errorMessage}` }],
    };
  }
}

export const ReverseGeocode = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};