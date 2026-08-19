import { Client, Language } from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";
import { Logger } from "../index.js";
import { getGoogleMapsLimiter } from "./concurrencyLimit.js";
import { gmapsCaughtToEnvelope } from "./mapsResponse.js";
import {
  buildRoutesBody,
  HttpRoutesClient,
  mapComputeRoutes,
  mapRouteMatrix,
  RoutesClient,
} from "./routesApi.js";
import {
  DEFAULT_PLACE_DETAILS_FIELDS,
  DirectionsOptions,
  DistanceMatrixData,
  DistanceMatrixOptions,
  ElevationOptions,
  ElevationPointOut,
  GeocodeOptions,
  GmapsEnvelope,
  LatLng,
  MapsRequestOptions,
  PlaceDetailsOptions,
  ReverseGeocodeOptions,
  SearchNearbyOptions,
  TravelModeName,
} from "./mapsTypes.js";

dotenv.config();

interface SearchParams extends SearchNearbyOptions {
  location: LatLng;
}

interface SlimLocation {
  lat: number;
  lng: number;
  formatted_address?: string;
  place_id?: string;
}

function redactParams(params: Record<string, unknown>): Record<string, unknown> {
  if (params.key) {
    return { ...params, key: "***" };
  }
  return params;
}

/** Drop unset keys. The GMaps client serializer crashes on `bounds: undefined` (reads `.southwest`). */
function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    out[key] = value;
  }
  return out;
}

function failCaught<T>(label: string, error: unknown, data: T): GmapsEnvelope<T> {
  const parsed = gmapsCaughtToEnvelope(error);
  Logger.error(label, parsed.error_message);
  return { status: parsed.status, error_message: parsed.error_message, data };
}

function logJson(label: string, value: unknown): void {
  Logger.log(label, JSON.stringify(value).replace(/\n/g, " "));
}

export class GoogleMapsTools {
  private client: Client;
  private routes: RoutesClient;
  private readonly defaultLanguage: Language = Language.en;

  constructor(client?: Client, routesClient?: RoutesClient) {
    this.client = client ?? new Client({});
    this.routes = routesClient ?? new HttpRoutesClient(() => this.apiKey());
    if (!client && !process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API Key is required");
    }
  }

  private withLimit<T>(fn: () => Promise<T>): Promise<T> {
    return getGoogleMapsLimiter().run(fn);
  }

  private language(options?: MapsRequestOptions): string {
    return options?.language || this.defaultLanguage;
  }

  private apiKey(): string {
    return process.env.GOOGLE_MAPS_API_KEY || "";
  }

  async searchNearbyPlaces(params: SearchParams): Promise<GmapsEnvelope<any[]>> {
    return this.withLimit(async () => {
      const searchParams: Record<string, unknown> = compactParams({
        location: params.location,
        keyword: params.keyword,
        opennow: params.openNow,
        language: this.language(params),
        region: params.region,
        type: params.type,
        minprice: params.minPrice,
        maxprice: params.maxPrice,
        pagetoken: params.pageToken,
        key: this.apiKey(),
      });

      if (params.rankBy === "distance") {
        searchParams.rankby = "distance";
      } else {
        searchParams.radius = params.radius || 1000;
      }

      logJson("Google Maps API - Places Nearby Request:", redactParams(searchParams));

      try {
        const response = await this.client.placesNearby({
          params: searchParams as any,
        });

        logJson("Google Maps API - Places Nearby Response:", response.data);

        let results = response.data.results || [];
        if (params.minRating) {
          results = results.filter((place: any) => (place.rating || 0) >= (params.minRating || 0));
        }

        return {
          status: response.data.status,
          error_message: (response.data as any).error_message,
          html_attributions: response.data.html_attributions,
          next_page_token: response.data.next_page_token,
          data: results,
        };
      } catch (error) {
        return failCaught("Error in searchNearbyPlaces:", error, []);
      }
    });
  }

  async getPlaceDetails(placeId: string, options: PlaceDetailsOptions = {}): Promise<GmapsEnvelope<any>> {
    return this.withLimit(async () => {
      const fields = options.fields && options.fields.length > 0 ? options.fields : DEFAULT_PLACE_DETAILS_FIELDS;
      const requestParams = compactParams({
        place_id: placeId,
        fields,
        language: this.language(options),
        region: options.region,
        sessiontoken: options.sessionToken,
        key: this.apiKey(),
      });

      logJson("Google Maps API - Place Details Request:", redactParams(requestParams));

      try {
        const response = await this.client.placeDetails({
          params: requestParams as any,
        });

        logJson("Google Maps API - Place Details Response:", response.data);

        return {
          status: response.data.status,
          error_message: (response.data as any).error_message,
          html_attributions: response.data.html_attributions,
          data: response.data.result,
        };
      } catch (error) {
        return failCaught("Error in getPlaceDetails:", error, undefined);
      }
    });
  }

  private async geocodeAddress(address: string, options: MapsRequestOptions = {}): Promise<SlimLocation> {
    const envelope = await this.geocodeRaw({ address, ...options });
    if (!envelope.data.length) {
      throw new Error("No location found for the specified address");
    }
    const result = envelope.data[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    };
  }

  async geocodeRaw(options: GeocodeOptions): Promise<GmapsEnvelope<any[]>> {
    return this.withLimit(async () => {
      const requestParams = compactParams({
        address: options.address,
        place_id: options.placeId,
        bounds: options.bounds,
        components: options.components,
        language: this.language(options),
        region: options.region,
        key: this.apiKey(),
      });

      logJson("Google Maps API - Geocode Request:", redactParams(requestParams));

      try {
        const response = await this.client.geocode({
          params: requestParams as any,
        });

        logJson("Google Maps API - Geocode Response:", response.data);

        return {
          status: response.data.status,
          error_message: (response.data as any).error_message,
          data: response.data.results || [],
        };
      } catch (error) {
        return failCaught("Error in geocodeRaw:", error, []);
      }
    });
  }

  private parseCoordinates(coordString: string): SlimLocation {
    const coords = coordString.split(",").map((c) => parseFloat(c.trim()));
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
      throw new Error("Invalid coordinate format. Please use 'latitude,longitude' format");
    }
    return { lat: coords[0], lng: coords[1] };
  }

  async getLocation(center: { value: string; isCoordinates: boolean }): Promise<SlimLocation> {
    if (center.isCoordinates) {
      return this.parseCoordinates(center.value);
    }
    return this.geocodeAddress(center.value);
  }

  async reverseGeocodeRaw(options: ReverseGeocodeOptions): Promise<GmapsEnvelope<any[]>> {
    return this.withLimit(async () => {
      const requestParams = compactParams({
        language: this.language(options),
        region: options.region,
        result_type: options.resultType,
        location_type: options.locationType,
        extra_computations: options.enableAddressDescriptor ? ["ADDRESS_DESCRIPTOR"] : undefined,
        key: this.apiKey(),
        ...(options.placeId
          ? { place_id: options.placeId }
          : { latlng: { lat: options.latitude, lng: options.longitude } }),
      });

      logJson("Google Maps API - Reverse Geocode Request:", redactParams(requestParams));

      try {
        const response = await this.client.reverseGeocode({
          params: requestParams as any,
        });

        logJson("Google Maps API - Reverse Geocode Response:", response.data);

        return {
          status: response.data.status,
          error_message: (response.data as any).error_message,
          data: response.data.results || [],
        };
      } catch (error) {
        return failCaught("Error in reverseGeocode:", error, []);
      }
    });
  }

  async calculateDistanceMatrix(
    origins: string[],
    destinations: string[],
    mode: TravelModeName = "driving",
    options: DistanceMatrixOptions = {}
  ): Promise<GmapsEnvelope<DistanceMatrixData>> {
    const empty: DistanceMatrixData = {
      origin_addresses: [],
      destination_addresses: [],
      elements: [],
      distances: [],
      durations: [],
    };
    return this.withLimit(async () => {
      const departureTime = options.departureTime ? new Date(options.departureTime) : undefined;
      const arrivalTime = options.arrivalTime ? new Date(options.arrivalTime) : undefined;
      const body = buildRoutesBody({
        origins,
        destinations,
        mode,
        language: this.language(options),
        region: options.region,
        avoid: options.avoid,
        units: options.units,
        trafficModel: options.trafficModel,
        transitMode: options.transitMode,
        transitRoutingPreference: options.transitRoutingPreference,
        departureTime,
        arrivalTime,
        forMatrix: true,
      });
      const trafficAware = body.routingPreference === "TRAFFIC_AWARE";

      logJson("Google Maps Routes API - Route Matrix Request:", body);

      try {
        const raw = await this.routes.computeRouteMatrix(body);
        logJson("Google Maps Routes API - Route Matrix Response:", raw);
        return {
          status: "OK",
          data: mapRouteMatrix(origins, destinations, raw, { units: options.units, trafficAware }),
        };
      } catch (error) {
        return failCaught("Error in calculateDistanceMatrix:", error, empty);
      }
    });
  }

  async getDirections(
    origin: string,
    destination: string,
    mode: TravelModeName = "driving",
    departure_time?: Date,
    arrival_time?: Date,
    options: DirectionsOptions = {}
  ): Promise<GmapsEnvelope<any>> {
    return this.withLimit(async () => {
      try {
        const body = buildRoutesBody({
          origin,
          destination,
          mode,
          language: this.language(options),
          region: options.region,
          waypoints: options.waypoints,
          alternatives: options.alternatives,
          optimizeWaypoints: options.optimizeWaypoints,
          avoid: options.avoid,
          units: options.units,
          trafficModel: options.trafficModel,
          transitMode: options.transitMode,
          transitRoutingPreference: options.transitRoutingPreference,
          departureTime: departure_time,
          arrivalTime: arrival_time,
        });
        const trafficAware = body.routingPreference === "TRAFFIC_AWARE";

        logJson("Google Maps Routes API - Compute Routes Request:", body);

        const raw = await this.routes.computeRoutes(body);
        logJson("Google Maps Routes API - Compute Routes Response:", raw);

        const mapped = mapComputeRoutes(raw, { units: options.units, trafficAware });
        return {
          status: mapped.status,
          error_message: mapped.routes.length ? undefined : "No routes returned",
          data: mapped,
        };
      } catch (error) {
        return failCaught("Error in getDirections:", error, { routes: [] });
      }
    });
  }

  async getElevation(options: ElevationOptions): Promise<GmapsEnvelope<ElevationPointOut[]>> {
    return this.withLimit(async () => {
      try {
        const requestParams = compactParams({
          key: this.apiKey(),
          ...(options.path && options.samples
            ? {
                path: options.path.map((loc) => ({ lat: loc.latitude, lng: loc.longitude })),
                samples: options.samples,
              }
            : {
                locations: (options.locations || []).map((loc) => ({
                  lat: loc.latitude,
                  lng: loc.longitude,
                })),
              }),
        });

        logJson("Google Maps API - Elevation Request:", redactParams(requestParams));

        const response = await this.client.elevation({
          params: requestParams as any,
        });

        logJson("Google Maps API - Elevation Response:", response.data);

        const result = response.data;
        const data: ElevationPointOut[] = (result.results || []).map((item: any) => ({
          elevation: item.elevation,
          location: item.location,
          resolution: item.resolution,
        }));

        return {
          status: result.status,
          error_message: (result as any).error_message,
          data,
        };
      } catch (error) {
        return failCaught("Error in getElevation:", error, []);
      }
    });
  }
}
