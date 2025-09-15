import { z } from "zod";
import { PlacesSearcher } from "../../services/PlacesSearcher.js";

const NAME = "search_nearby";
const DESCRIPTION = "Search for nearby places based on location, with optional filtering by keywords, distance, rating, and operating hours";

const SCHEMA = {
  center: z.object({
    value: z.string().describe("Address, landmark name, or coordinates (coordinate format: lat,lng)"),
    isCoordinates: z.boolean().default(false).describe("Whether the value is coordinates"),
  }).describe("Search center point"),
  keyword: z.string().optional().describe("Search keyword (e.g., restaurant, cafe, hotel)"),
  radius: z.number().default(1000).describe("Search radius in meters"),
  openNow: z.boolean().default(false).describe("Only show places that are currently open"),
  minRating: z.number().min(0).max(5).optional().describe("Minimum rating requirement (0-5)"),
};

export type SearchNearbyParams = z.infer<z.ZodObject<typeof SCHEMA>>;

let placesSearcher: PlacesSearcher | null = null;

async function ACTION(params: SearchNearbyParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    if (!placesSearcher) {
      placesSearcher = new PlacesSearcher();
    }
    const result = await placesSearcher.searchNearby(params);

    if (!result.success) {
      return {
        content: [{ type: "text", text: result.error || "Search failed" }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `location: ${JSON.stringify(result.location, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' ')}\n` + JSON.stringify(result.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '),
        },
      ],
      isError: false,
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    return {
      isError: true,
      content: [{ type: "text", text: `Error searching nearby places: ${errorMessage}` }],
    };
  }
}

export const SearchNearby = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};