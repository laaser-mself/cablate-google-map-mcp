import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";

const NAME = "maps_geocode";
const DESCRIPTION = "Convert addresses or place names to geographic coordinates (latitude and longitude)";

const SCHEMA = {
  address: z.string().describe("Address or place name to convert to coordinates"),
};

export type GeocodeParams = z.infer<z.ZodObject<typeof SCHEMA>>;

async function ACTION(params: GeocodeParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const result = await getSharedPlacesSearcher().geocode(params.address);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Geocoding failed" }],
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
      content: [{ type: "text", text: `Geocoding error: ${errorMessage}` }],
    };
  }
}

export const Geocode = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};