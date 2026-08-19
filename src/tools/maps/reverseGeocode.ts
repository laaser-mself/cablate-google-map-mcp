import { z } from "zod";
import { getSharedPlacesSearcher } from "../../services/sharedPlacesSearcher.js";
import { caughtErrorToMcp, toMcpContent } from "../../services/mapsResponse.js";
import { commonMapsParams } from "./commonSchema.js";

const NAME = "maps_reverse_geocode";
const DESCRIPTION = "Convert geographic coordinates or a place ID to a human-readable address. Returns the primary match plus alternates.";

const SCHEMA = {
  latitude: z.number().optional().describe("Latitude coordinate"),
  longitude: z.number().optional().describe("Longitude coordinate"),
  placeId: z.string().optional().describe("Google Maps place ID to reverse-geocode"),
  resultType: z.array(z.string()).optional().describe("Filter by address result types"),
  locationType: z.array(z.string()).optional().describe("Filter by geometry location types"),
  enableAddressDescriptor: z.boolean().optional().describe("Request ADDRESS_DESCRIPTOR extra computation"),
  resultIndex: z.number().int().min(0).optional().describe("Which result to treat as primary (default 0)"),
  includeAlternates: z.boolean().optional().describe("Include remaining results in data.alternates (default true)"),
  ...commonMapsParams,
};

export const ReverseGeocodeSchema = z.object(SCHEMA).superRefine((value, ctx) => {
  const hasLatLng = value.latitude !== undefined && value.longitude !== undefined;
  const hasPartialLatLng = (value.latitude !== undefined) !== (value.longitude !== undefined);
  if (hasPartialLatLng) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "latitude and longitude must be provided together" });
  }
  if (!hasLatLng && !value.placeId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide (latitude AND longitude) OR placeId" });
  }
});

export type ReverseGeocodeParams = z.infer<typeof ReverseGeocodeSchema>;

async function ACTION(params: ReverseGeocodeParams): Promise<{ content: any[]; isError?: boolean }> {
  try {
    const parsed = ReverseGeocodeSchema.parse(params);
    const result = await getSharedPlacesSearcher().reverseGeocode(parsed);
    return toMcpContent(result);
  } catch (error: any) {
    return caughtErrorToMcp(NAME, error);
  }
}

export const ReverseGeocode = {
  NAME,
  DESCRIPTION,
  SCHEMA,
  ACTION,
};
