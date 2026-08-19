import { Client, Language, TravelMode } from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";
import { Logger } from "../index.js";
import { getGoogleMapsLimiter } from "./concurrencyLimit.js";

dotenv.config();

interface SearchParams {
  location: { lat: number; lng: number };
  radius?: number;
  keyword?: string;
  openNow?: boolean;
  minRating?: number;
}

interface PlaceResult {
  name: string;
  place_id: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
  };
}

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address?: string;
  place_id?: string;
}

export class GoogleMapsTools {
  private client: Client;
  private readonly defaultLanguage: Language = Language.en;

  constructor() {
    this.client = new Client({});
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error("Google Maps API Key is required");
    }
  }

  private withLimit<T>(fn: () => Promise<T>): Promise<T> {
    return getGoogleMapsLimiter().run(fn);
  }

  async searchNearbyPlaces(params: SearchParams): Promise<PlaceResult[]> {
    return this.withLimit(async () => {
    const searchParams = {
      location: params.location,
      radius: params.radius || 1000,
      keyword: params.keyword,
      opennow: params.openNow,
      language: this.defaultLanguage,
      key: process.env.GOOGLE_MAPS_API_KEY || "",
    };

    Logger.log("Google Maps API - Places Nearby Request:", JSON.stringify(searchParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

    try {
      const response = await this.client.placesNearby({
        params: searchParams,
      });

      Logger.log("Google Maps API - Places Nearby Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      let results = response.data.results;

      if (params.minRating) {
        results = results.filter((place) => (place.rating || 0) >= (params.minRating || 0));
      }

      return results as PlaceResult[];
    } catch (error) {
      Logger.error("Error in searchNearbyPlaces:", error);
      throw new Error("An error occurred while searching nearby places");
    }
    });
  }

  async getPlaceDetails(placeId: string) {
    return this.withLimit(async () => {
    const requestParams = {
      place_id: placeId,
      fields: ["name", "rating", "formatted_address", "opening_hours", "reviews", "geometry", "formatted_phone_number", "website", "price_level", "photos"],
      language: this.defaultLanguage,
      key: process.env.GOOGLE_MAPS_API_KEY || "",
    };

    Logger.log("Google Maps API - Place Details Request:", JSON.stringify(requestParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

    try {
      const response = await this.client.placeDetails({
        params: requestParams,
      });

      Logger.log("Google Maps API - Place Details Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      return response.data.result;
    } catch (error) {
      Logger.error("Error in getPlaceDetails:", error);
      throw new Error("An error occurred while fetching place details");
    }
    });
  }

  private async geocodeAddress(address: string): Promise<GeocodeResult> {
    return this.withLimit(async () => {
    const requestParams = {
      address: address,
      key: process.env.GOOGLE_MAPS_API_KEY || "",
      language: this.defaultLanguage,
    };

    Logger.log("Google Maps API - Geocode Request:", JSON.stringify(requestParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

    try {
      const response = await this.client.geocode({
        params: requestParams,
      });

      Logger.log("Google Maps API - Geocode Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      if (response.data.results.length === 0) {
        throw new Error("No location found for the specified address");
      }

      const result = response.data.results[0];
      const location = result.geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id,
      };
    } catch (error) {
      Logger.error("Error in geocodeAddress:", error);
      throw new Error("An error occurred while converting the address to coordinates");
    }
    });
  }

  private parseCoordinates(coordString: string): GeocodeResult {
    const coords = coordString.split(",").map((c) => parseFloat(c.trim()));
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
      throw new Error("Invalid coordinate format. Please use 'latitude,longitude' format");
    }
    return { lat: coords[0], lng: coords[1] };
  }

  async getLocation(center: { value: string; isCoordinates: boolean }): Promise<GeocodeResult> {
    if (center.isCoordinates) {
      return this.parseCoordinates(center.value);
    }
    return this.geocodeAddress(center.value);
  }

  async geocode(address: string): Promise<{
    location: { lat: number; lng: number };
    formatted_address: string;
    place_id: string;
  }> {
    try {
      const result = await this.geocodeAddress(address);
      return {
        location: { lat: result.lat, lng: result.lng },
        formatted_address: result.formatted_address || "",
        place_id: result.place_id || "",
      };
    } catch (error) {
      Logger.error("Error in geocode:", error);
      throw new Error("An error occurred while converting the address to coordinates");
    }
  }

  async reverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<{
    formatted_address: string;
    place_id: string;
    address_components: any[];
  }> {
    return this.withLimit(async () => {
    const requestParams = {
      latlng: { lat: latitude, lng: longitude },
      language: this.defaultLanguage,
      key: process.env.GOOGLE_MAPS_API_KEY || "",
    };

    Logger.log("Google Maps API - Reverse Geocode Request:", JSON.stringify(requestParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

    try {
      const response = await this.client.reverseGeocode({
        params: requestParams,
      });

      Logger.log("Google Maps API - Reverse Geocode Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      if (response.data.results.length === 0) {
        throw new Error("No address found for the specified coordinates");
      }

      const result = response.data.results[0];
      return {
        formatted_address: result.formatted_address,
        place_id: result.place_id,
        address_components: result.address_components,
      };
    } catch (error) {
      Logger.error("Error in reverseGeocode:", error);
      throw new Error("An error occurred while converting coordinates to an address");
    }
    });
  }

  async calculateDistanceMatrix(
    origins: string[],
    destinations: string[],
    mode: "driving" | "walking" | "bicycling" | "transit" = "driving"
  ): Promise<{
    distances: any[][];
    durations: any[][];
    origin_addresses: string[];
    destination_addresses: string[];
  }> {
    return this.withLimit(async () => {
    const requestParams = {
      origins: origins,
      destinations: destinations,
      mode: mode as TravelMode,
      language: this.defaultLanguage,
      key: process.env.GOOGLE_MAPS_API_KEY || "",
    };

    Logger.log("Google Maps API - Distance Matrix Request:", JSON.stringify(requestParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

    try {
      const response = await this.client.distancematrix({
        params: requestParams,
      });

      Logger.log("Google Maps API - Distance Matrix Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      const result = response.data;

      if (result.status !== "OK") {
        throw new Error(`Distance matrix computation failed: ${result.status}`);
      }

      const distances: any[][] = [];
      const durations: any[][] = [];

      result.rows.forEach((row: any) => {
        const distanceRow: any[] = [];
        const durationRow: any[] = [];

        row.elements.forEach((element: any) => {
          if (element.status === "OK") {
            distanceRow.push({
              value: element.distance.value,
              text: element.distance.text,
            });
            durationRow.push({
              value: element.duration.value,
              text: element.duration.text,
            });
          } else {
            distanceRow.push(null);
            durationRow.push(null);
          }
        });

        distances.push(distanceRow);
        durations.push(durationRow);
      });

      return {
        distances: distances,
        durations: durations,
        origin_addresses: result.origin_addresses,
        destination_addresses: result.destination_addresses,
      };
    } catch (error) {
      Logger.error("Error in calculateDistanceMatrix:", error);
      throw new Error("An error occurred while calculating the distance matrix");
    }
    });
  }

  async getDirections(
    origin: string,
    destination: string,
    mode: "driving" | "walking" | "bicycling" | "transit" = "driving",
    departure_time?: Date,
    arrival_time?: Date
  ): Promise<{
    routes: any[];
    summary: string;
    total_distance: { value: number; text: string };
    total_duration: { value: number; text: string };
    arrival_time: string;
    departure_time: string;
  }> {
    return this.withLimit(async () => {
    try {
      let apiArrivalTime: number | undefined = undefined;
      if (arrival_time) {
        apiArrivalTime = Math.floor(arrival_time.getTime() / 1000);
      }

      let apiDepartureTime: number | "now" | undefined = undefined;
      if (!apiArrivalTime) {
        if (departure_time instanceof Date) {
          apiDepartureTime = Math.floor(departure_time.getTime() / 1000);
        } else if (departure_time) {
          apiDepartureTime = departure_time as unknown as "now";
        } else {
          apiDepartureTime = "now";
        }
      }

      const requestParams = {
        origin: origin,
        destination: destination,
        mode: mode as TravelMode,
        language: this.defaultLanguage,
        key: process.env.GOOGLE_MAPS_API_KEY || "",
        arrival_time: apiArrivalTime,
        departure_time: apiDepartureTime,
      };

      Logger.log("Google Maps API - Directions Request:", JSON.stringify(requestParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      const response = await this.client.directions({
        params: requestParams,
      });

      Logger.log("Google Maps API - Directions Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      const result = response.data;

      if (result.status !== "OK") {
        throw new Error(`Failed to retrieve directions: ${result.status} (arrival_time: ${apiArrivalTime}, departure_time: ${apiDepartureTime})`);
      }

      if (result.routes.length === 0) {
        throw new Error("No routes found");
      }

      const route = result.routes[0];
      const legs = route.legs[0];

      const formatTime = (timeInfo: any) => {
        if (!timeInfo || typeof timeInfo.value !== "number") return "";
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
        return date.toLocaleString(this.defaultLanguage.toString(), options);
      };

      return {
        routes: result.routes,
        summary: route.summary,
        total_distance: {
          value: legs.distance.value,
          text: legs.distance.text,
        },
        total_duration: {
          value: legs.duration.value,
          text: legs.duration.text,
        },
        arrival_time: formatTime(legs.arrival_time),
        departure_time: formatTime(legs.departure_time),
      };
    } catch (error) {
      Logger.error("Error in getDirections:", error);
      throw new Error("An error occurred while retrieving directions: " + error);
    }
    });
  }

  async getElevation(locations: Array<{ latitude: number; longitude: number }>): Promise<Array<{ elevation: number; location: { lat: number; lng: number } }>> {
    return this.withLimit(async () => {
    try {
      const formattedLocations = locations.map((loc) => ({
        lat: loc.latitude,
        lng: loc.longitude,
      }));

      const requestParams = {
        locations: formattedLocations,
        key: process.env.GOOGLE_MAPS_API_KEY || "",
      };

      Logger.log("Google Maps API - Elevation Request:", JSON.stringify(requestParams, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      const response = await this.client.elevation({
        params: requestParams,
      });

      Logger.log("Google Maps API - Elevation Response:", JSON.stringify(response.data, null, 2).replace(/\n/g, ' ').replace(/  +/g, ' '));

      const result = response.data;

      if (result.status !== "OK") {
        throw new Error(`Failed to retrieve elevation data: ${result.status}`);
      }

      return result.results.map((item: any, index: number) => ({
        elevation: item.elevation,
        location: formattedLocations[index],
      }));
    } catch (error) {
      Logger.error("Error in getElevation:", error);
      throw new Error("An error occurred while retrieving elevation data");
    }
    });
  }
}
