import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";
import { commonMapsParams } from "./commonSchema.js";

const NAME = "maps_geocode";
const DESCRIPTION = "Convert addresses, place IDs, or component filters to geographic coordinates. Returns the primary match plus alternates.";

const SCHEMA = {
  address: z.string().optional().describe("Address or place name to convert to coordinates"),
  placeId: z.string().optional().describe("Google Maps place ID to geocode"),
  bounds: z.object({
    southwest: z.object({ lat: z.number(), lng: z.number() }),
    northeast: z.object({ lat: z.number(), lng: z.number() }),
  }).optional().describe("Viewport bias bounds"),
  components: z.string().optional().describe("Component filter string, e.g. country:US"),
  resultIndex: z.number().int().min(0).optional().describe("Which result to treat as primary (default 0)"),
  includeAlternates: z.boolean().optional().describe("Include remaining results in data.alternates (default true)"),
  ...commonMapsParams,
};

export const GeocodeSchema = z.object(SCHEMA).superRefine((value, ctx) => {
  if (!value.address && !value.placeId && !value.components) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "One of address, placeId, or components is required" });
  }
});

export type GeocodeParams = z.infer<typeof GeocodeSchema>;

async function ACTION(params: GeocodeParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = GeocodeSchema.parse(params);
    const result = await getSharedPlacesSearcher().geocode(parsed);
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const Geocode = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
