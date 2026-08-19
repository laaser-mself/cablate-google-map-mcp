import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";
import { commonMapsParams } from "./commonSchema.js";

const NAME = "search_nearby";
const DESCRIPTION = "Search for nearby places based on location, with optional filtering by keywords, distance, rating, operating hours, price, and place type";

const SCHEMA = {
  center: z.object({
    value: z.string().describe("Address, landmark name, or coordinates (coordinate format: lat,lng)"),
    isCoordinates: z.boolean().default(false).describe("Whether the value is coordinates"),
  }).describe("Search center point"),
  keyword: z.string().optional().describe("Search keyword (e.g., restaurant, cafe, hotel)"),
  radius: z.number().optional().describe("Search radius in meters (default 1000; not valid with rankBy=distance)"),
  openNow: z.boolean().default(false).describe("Only show places that are currently open"),
  minRating: z.number().min(0).max(5).optional().describe("Minimum rating requirement (0-5)"),
  type: z.string().optional().describe("Google Places type filter, e.g. restaurant"),
  rankBy: z.enum(["prominence", "distance"]).optional().describe("Ranking method; distance requires keyword or type and forbids radius"),
  minPrice: z.number().min(0).max(4).optional().describe("Minimum price level 0-4"),
  maxPrice: z.number().min(0).max(4).optional().describe("Maximum price level 0-4"),
  pageToken: z.string().optional().describe("Pagination token from a previous search_nearby next_page_token"),
  ...commonMapsParams,
};

export const SearchNearbySchema = z.object(SCHEMA).superRefine((value, ctx) => {
  if (value.rankBy === "distance") {
    if (!value.keyword && !value.type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "rankBy=distance requires keyword or type" });
    }
    if (value.radius !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "radius cannot be combined with rankBy=distance" });
    }
  }
});

export type SearchNearbyParams = z.infer<typeof SearchNearbySchema>;

async function ACTION(params: SearchNearbyParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = SearchNearbySchema.parse(params);
    const result = await getSharedPlacesSearcher().searchNearby(parsed);
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const SearchNearby = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
