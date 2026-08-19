import { getSharedGoogleMapsTools } from "./sharedGoogleMapsTools.js";
import { GoogleMapsTools } from "./toolclass.js";
import { buildToolResult, failToolResult } from "./mapsResponse.js";
import {
  DirectionsData,
  DirectionsOptions,
  DistanceMatrixData,
  DistanceMatrixOptions,
  ElevationOptions,
  ElevationPointOut,
  GeocodeAlternate,
  GeocodeData,
  GeocodeOptions,
  McpToolResult,
  NearbyPlaceOut,
  PlaceDetailsData,
  PlaceDetailsOptions,
  ReverseGeocodeData,
  ReverseGeocodeOptions,
  SearchNearbyData,
  SearchNearbyOptions,
  TravelModeName,
} from "./mapsTypes.js";

function projectAlternate(result: any): GeocodeAlternate {
  return {
    formatted_address: result.formatted_address,
    place_id: result.place_id,
    location: result.geometry?.location,
    location_type: result.geometry?.location_type,
    types: result.types,
  };
}

function mapGeocodeResult(primary: any, rest: any[], includeAlternates = true): GeocodeData {
  return {
    location: primary.geometry.location,
    formatted_address: primary.formatted_address || "",
    place_id: primary.place_id || "",
    location_type: primary.geometry?.location_type,
    types: primary.types,
    partial_match: primary.partial_match,
    address_components: primary.address_components,
    viewport: primary.geometry?.viewport,
    plus_code: primary.plus_code,
    alternates: includeAlternates ? rest.map(projectAlternate) : [],
  };
}

function formatTime(timeInfo: any, language: string): string {
  if (!timeInfo || typeof timeInfo.value !== "number") {
    return "";
  }
  const date = new Date(timeInfo.value * 1000);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  if (timeInfo.time_zone && typeof timeInfo.time_zone === "string") {
    options.timeZone = timeInfo.time_zone;
  }
  return date.toLocaleString(language, options);
}

export class PlacesSearcher {
  private readonly mapsTools: GoogleMapsTools;

  constructor(mapsTools?: GoogleMapsTools) {
    this.mapsTools = mapsTools ?? getSharedGoogleMapsTools();
  }

  async searchNearby(params: {
    center: { value: string; isCoordinates: boolean };
  } & SearchNearbyOptions): Promise<McpToolResult<SearchNearbyData | null>> {
    try {
      const location = await this.mapsTools.getLocation(params.center);
      const envelope = await this.mapsTools.searchNearbyPlaces({
        ...params,
        location,
      });

      const results: NearbyPlaceOut[] = (envelope.data || []).map((place: any) => ({
        name: place.name,
        place_id: place.place_id,
        address: place.formatted_address,
        vicinity: place.vicinity,
        location: place.geometry?.location,
        rating: place.rating,
        total_ratings: place.user_ratings_total,
        open_now: place.opening_hours?.open_now,
        price_level: place.price_level,
        business_status: place.business_status,
        types: place.types,
      }));

      return buildToolResult("search_nearby", envelope, {
        center: location,
        results,
      });
    } catch (error) {
      return failToolResult(
        "search_nearby",
        error instanceof Error ? error.message : "An error occurred during the search"
      );
    }
  }

  async getPlaceDetails(placeId: string, options: PlaceDetailsOptions = {}): Promise<McpToolResult<PlaceDetailsData | null>> {
    try {
      const envelope = await this.mapsTools.getPlaceDetails(placeId, options);
      const details = envelope.data || {};
      const data: PlaceDetailsData = {
        name: details.name,
        place_id: details.place_id,
        address: details.formatted_address,
        location: details.geometry?.location,
        viewport: details.geometry?.viewport,
        rating: details.rating,
        total_ratings: details.user_ratings_total,
        open_now: details.opening_hours?.open_now,
        opening_hours: details.opening_hours,
        phone: details.formatted_phone_number,
        international_phone: details.international_phone_number,
        website: details.website,
        price_level: details.price_level,
        photos: details.photos,
        business_status: details.business_status,
        types: details.types,
        url: details.url,
        utc_offset: details.utc_offset,
        address_components: details.address_components,
        reviews: details.reviews?.map((review: any) => ({
          rating: review.rating,
          text: review.text,
          time: review.time,
          author_name: review.author_name,
          author_url: review.author_url,
          profile_photo_url: review.profile_photo_url,
          language: review.language,
          relative_time_description: review.relative_time_description,
        })),
      };

      return buildToolResult("get_place_details", envelope, data);
    } catch (error) {
      return failToolResult(
        "get_place_details",
        error instanceof Error ? error.message : "An error occurred while fetching details"
      );
    }
  }

  async geocode(options: GeocodeOptions): Promise<McpToolResult<GeocodeData | null>> {
    try {
      const envelope = await this.mapsTools.geocodeRaw(options);
      if (!envelope.data.length) {
        return buildToolResult("maps_geocode", envelope, null, envelope.status === "ZERO_RESULTS");
      }
      const index = options.resultIndex && options.resultIndex >= 0 ? options.resultIndex : 0;
      const primary = envelope.data[index] || envelope.data[0];
      const rest = envelope.data.filter((item: any) => item !== primary);
      const includeAlternates = options.includeAlternates !== false;
      return buildToolResult("maps_geocode", envelope, mapGeocodeResult(primary, rest, includeAlternates));
    } catch (error) {
      return failToolResult(
        "maps_geocode",
        error instanceof Error ? error.message : "An error occurred while converting the address to coordinates"
      );
    }
  }

  async reverseGeocode(options: ReverseGeocodeOptions): Promise<McpToolResult<ReverseGeocodeData | null>> {
    try {
      const envelope = await this.mapsTools.reverseGeocodeRaw(options);
      if (!envelope.data.length) {
        return buildToolResult("maps_reverse_geocode", envelope, null, envelope.status === "ZERO_RESULTS");
      }
      const index = options.resultIndex && options.resultIndex >= 0 ? options.resultIndex : 0;
      const primary = envelope.data[index] || envelope.data[0];
      const rest = envelope.data.filter((item: any) => item !== primary);
      const includeAlternates = options.includeAlternates !== false;
      const data: ReverseGeocodeData = {
        formatted_address: primary.formatted_address,
        place_id: primary.place_id,
        address_components: primary.address_components,
        geometry: primary.geometry,
        types: primary.types,
        plus_code: primary.plus_code,
        alternates: includeAlternates ? rest.map(projectAlternate) : [],
      };
      return buildToolResult("maps_reverse_geocode", envelope, data);
    } catch (error) {
      return failToolResult(
        "maps_reverse_geocode",
        error instanceof Error ? error.message : "An error occurred while converting coordinates to an address"
      );
    }
  }

  async calculateDistanceMatrix(
    origins: string[],
    destinations: string[],
    mode: TravelModeName = "driving",
    options: DistanceMatrixOptions = {}
  ): Promise<McpToolResult<DistanceMatrixData | null>> {
    try {
      const envelope = await this.mapsTools.calculateDistanceMatrix(origins, destinations, mode, options);
      if (envelope.status !== "OK") {
        return failToolResult("maps_distance_matrix", envelope.error_message || `Distance matrix computation failed: ${envelope.status}`, envelope.status);
      }
      return buildToolResult("maps_distance_matrix", envelope, envelope.data);
    } catch (error) {
      return failToolResult(
        "maps_distance_matrix",
        error instanceof Error ? error.message : "An error occurred while calculating the distance matrix"
      );
    }
  }

  async getDirections(
    origin: string,
    destination: string,
    mode: TravelModeName = "driving",
    options: DirectionsOptions = {}
  ): Promise<McpToolResult<DirectionsData | null>> {
    try {
      const departureTime = options.departureTime ? new Date(options.departureTime) : undefined;
      const arrivalTime = options.arrivalTime ? new Date(options.arrivalTime) : undefined;
      const envelope = await this.mapsTools.getDirections(origin, destination, mode, departureTime, arrivalTime, options);
      const result = envelope.data;

      if (envelope.status !== "OK" || !result?.routes?.length) {
        return failToolResult(
          "maps_directions",
          envelope.error_message || `Failed to retrieve directions: ${envelope.status}`,
          envelope.status
        );
      }

      const route = result.routes[0];
      const legs = route.legs || [];
      const totalDistanceValue = legs.reduce((sum: number, leg: any) => sum + (leg.distance?.value || 0), 0);
      const totalDurationValue = legs.reduce((sum: number, leg: any) => sum + (leg.duration?.value || 0), 0);
      const trafficValue = legs.reduce((sum: number, leg: any) => sum + (leg.duration_in_traffic?.value || 0), 0);
      const language = options.language || "en";

      const data: DirectionsData = {
        routes: result.routes,
        summary: route.summary || route.description || "",
        total_distance: {
          value: totalDistanceValue,
          text: legs[0]?.distance?.text ? `${totalDistanceValue} m` : String(totalDistanceValue),
        },
        total_duration: {
          value: totalDurationValue,
          text: `${totalDurationValue} s`,
        },
        arrival_time: formatTime(legs[legs.length - 1]?.arrival_time, language),
        departure_time: formatTime(legs[0]?.departure_time, language),
        geocoded_waypoints: result.geocoded_waypoints,
        available_travel_modes: result.available_travel_modes,
        copyrights: route.copyrights || `Powered by Google, ©${new Date().getFullYear()} Google`,
        warnings: route.warnings,
      };

      if (trafficValue > 0) {
        data.duration_in_traffic = { value: trafficValue, text: `${trafficValue} s` };
      }

      return buildToolResult("maps_directions", envelope, data);
    } catch (error) {
      return failToolResult(
        "maps_directions",
        error instanceof Error ? error.message : "An error occurred while retrieving directions"
      );
    }
  }

  async getElevation(options: ElevationOptions): Promise<McpToolResult<ElevationPointOut[] | null>> {
    try {
      const envelope = await this.mapsTools.getElevation(options);
      if (envelope.status !== "OK") {
        return failToolResult(
          "maps_elevation",
          envelope.error_message || `Failed to retrieve elevation data: ${envelope.status}`,
          envelope.status
        );
      }
      return buildToolResult("maps_elevation", envelope, envelope.data);
    } catch (error) {
      return failToolResult(
        "maps_elevation",
        error instanceof Error ? error.message : "An error occurred while retrieving elevation data"
      );
    }
  }
}
