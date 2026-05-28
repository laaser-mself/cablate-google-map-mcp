import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";

const NAME = "get_place_details";
const DESCRIPTION = "Get detailed information about a specific place including contact details, reviews, ratings, and operating hours";

const SCHEMA = {
  placeId: z.string().describe("Google Maps place ID"),
};

export type PlaceDetailsParams = z.infer<z.ZodObject<typeof SCHEMA>>;

async function ACTION(params: PlaceDetailsParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const result = await getSharedPlacesSearcher().getPlaceDetails(params.placeId);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Failed to fetch details" }],
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
      content: [{ type: "text", text: `Error fetching place details: ${errorMessage}` }],
    };
  }
}

export const PlaceDetails = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};