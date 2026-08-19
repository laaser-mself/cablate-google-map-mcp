import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";
import { commonMapsParams } from "./commonSchema.js";

const NAME = "get_place_details";
const DESCRIPTION = "Get detailed information about a specific place including contact details, reviews, ratings, photos, and operating hours";

const SCHEMA = {
  placeId: z.string().describe("Google Maps place ID"),
  fields: z.array(z.string()).optional().describe("Optional Place Details fields list; omit for the server default set"),
  sessionToken: z.string().optional().describe("Autocomplete session token for billing pairing"),
  ...commonMapsParams,
};

export const PlaceDetailsSchema = z.object(SCHEMA).superRefine((value, ctx) => {
  if (value.fields && value.fields.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "fields[] must not be empty (billing guard)" });
  }
});

export type PlaceDetailsParams = z.infer<typeof PlaceDetailsSchema>;

async function ACTION(params: PlaceDetailsParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = PlaceDetailsSchema.parse(params);
    const result = await getSharedPlacesSearcher().getPlaceDetails(parsed.placeId, parsed);
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const PlaceDetails = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
