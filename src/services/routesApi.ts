import { DistanceDuration, DistanceMatrixData, DistanceMatrixElementOut, TravelModeName } from "./mapsTypes.js";

export const ROUTES_COMPUTE_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
export const ROUTES_MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

export const ROUTES_COMPUTE_FIELD_MASK = [
  "routes.duration",
  "routes.staticDuration",
  "routes.distanceMeters",
  "routes.description",
  "routes.warnings",
  "routes.viewport",
  "routes.polyline.encodedPolyline",
  "routes.legs.duration",
  "routes.legs.staticDuration",
  "routes.legs.distanceMeters",
  "routes.legs.startLocation",
  "routes.legs.endLocation",
  "routes.optimizedIntermediateWaypointIndex",
  "geocodingResults",
].join(",");

export const ROUTES_MATRIX_FIELD_MASK =
  "originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration";

export interface RoutesClient {
  computeRoutes(body: Record<string, unknown>, fieldMask?: string): Promise<any>;
  computeRouteMatrix(body: Record<string, unknown>, fieldMask?: string): Promise<any>;
}

export class RoutesHttpError extends Error {
  response: { status: number; data: unknown };

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "RoutesHttpError";
    this.response = { status, data };
  }
}

function compact(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

export class HttpRoutesClient implements RoutesClient {
  constructor(
    private readonly getApiKey: () => string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private async post(url: string, fieldMask: string, body: Record<string, unknown>): Promise<any> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.getApiKey(),
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });
    const data = await parseBody(response);
    if (!response.ok) {
      const cloud = data as { error?: { message?: string } };
      throw new RoutesHttpError(
        cloud.error?.message || `Routes API HTTP ${response.status}`,
        response.status,
        data
      );
    }
    return data;
  }

  computeRoutes(body: Record<string, unknown>, fieldMask = ROUTES_COMPUTE_FIELD_MASK): Promise<any> {
    return this.post(ROUTES_COMPUTE_URL, fieldMask, body);
  }

  computeRouteMatrix(body: Record<string, unknown>, fieldMask = ROUTES_MATRIX_FIELD_MASK): Promise<any> {
    return this.post(ROUTES_MATRIX_URL, fieldMask, body);
  }
}

export function toTravelMode(mode: TravelModeName = "driving"): string {
  switch (mode) {
    case "walking":
      return "WALK";
    case "bicycling":
      return "BICYCLE";
    case "transit":
      return "TRANSIT";
    default:
      return "DRIVE";
  }
}

export function toWaypoint(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (/^place_id:/i.test(trimmed)) {
    return { placeId: trimmed.slice("place_id:".length) };
  }
  const parts = trimmed.split(",").map((part) => part.trim());
  if (parts.length === 2 && parts.every((part) => /^-?\d+(\.\d+)?$/.test(part))) {
    return {
      location: {
        latLng: { latitude: parseFloat(parts[0]), longitude: parseFloat(parts[1]) },
      },
    };
  }
  return { address: trimmed };
}

export function toRouteModifiers(avoid?: string[]): Record<string, boolean> | undefined {
  if (!avoid || avoid.length === 0) return undefined;
  const modifiers: Record<string, boolean> = {};
  for (const item of avoid) {
    if (item === "tolls") modifiers.avoidTolls = true;
    if (item === "highways") modifiers.avoidHighways = true;
    if (item === "ferries") modifiers.avoidFerries = true;
    if (item === "indoor") modifiers.avoidIndoor = true;
  }
  return Object.keys(modifiers).length ? modifiers : undefined;
}

export function toUnits(units?: string): string | undefined {
  if (!units) return undefined;
  if (units === "imperial") return "IMPERIAL";
  if (units === "metric") return "METRIC";
  return undefined;
}

export function toTrafficModel(model?: string): string | undefined {
  if (!model) return undefined;
  const mapped: Record<string, string> = {
    best_guess: "BEST_GUESS",
    pessimistic: "PESSIMISTIC",
    optimistic: "OPTIMISTIC",
  };
  return mapped[model];
}

export function toTransitPreferences(
  transitMode?: string[],
  transitRoutingPreference?: string
): Record<string, unknown> | undefined {
  const allowed = (transitMode || [])
    .map((mode) => {
      const key = mode.toLowerCase();
      if (key === "bus") return "BUS";
      if (key === "subway") return "SUBWAY";
      if (key === "train") return "TRAIN";
      if (key === "tram") return "LIGHT_RAIL";
      if (key === "rail") return "RAIL";
      return undefined;
    })
    .filter(Boolean);
  const routing =
    transitRoutingPreference &&
    ["LESS_WALKING", "FEWER_TRANSFERS"].includes(transitRoutingPreference.toUpperCase().replace(/-/g, "_"))
      ? transitRoutingPreference.toUpperCase().replace(/-/g, "_")
      : undefined;
  if (!allowed.length && !routing) return undefined;
  return compact({ allowedTravelModes: allowed, routingPreference: routing });
}

export function parseDurationSeconds(value?: string): number {
  if (!value) return 0;
  const match = /^(-?\d+(?:\.\d+)?)s$/.exec(value);
  return match ? Math.round(Number(match[1])) : 0;
}

export function distanceFromMeters(meters: number, units?: string): DistanceDuration {
  if (units === "imperial") {
    const miles = meters / 1609.344;
    return {
      value: meters,
      text: miles >= 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(meters * 3.28084)} ft`,
    };
  }
  return {
    value: meters,
    text: meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`,
  };
}

export function durationFromSeconds(seconds: number): DistanceDuration {
  if (seconds >= 60) {
    return { value: seconds, text: `${Math.round(seconds / 60)} min` };
  }
  return { value: seconds, text: `${seconds} secs` };
}

export function buildRoutesBody(params: {
  origin?: string;
  destination?: string;
  origins?: string[];
  destinations?: string[];
  mode?: TravelModeName;
  language?: string;
  region?: string;
  waypoints?: string[];
  alternatives?: boolean;
  optimizeWaypoints?: boolean;
  avoid?: string[];
  units?: string;
  trafficModel?: string;
  transitMode?: string[];
  transitRoutingPreference?: string;
  departureTime?: Date | string;
  arrivalTime?: Date | string;
  forMatrix?: boolean;
}): Record<string, unknown> {
  const travelMode = toTravelMode(params.mode);
  const modifiers = toRouteModifiers(params.avoid);
  const departure =
    params.departureTime instanceof Date
      ? params.departureTime.toISOString()
      : params.departureTime;
  const arrival =
    params.arrivalTime instanceof Date ? params.arrivalTime.toISOString() : params.arrivalTime;
  const trafficAware = Boolean(departure) && travelMode === "DRIVE";

  const shared = compact({
    travelMode,
    routingPreference: travelMode === "DRIVE" ? (trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE") : undefined,
    languageCode: params.forMatrix ? undefined : params.language,
    regionCode: params.region,
    units: toUnits(params.units),
    departureTime: departure,
    arrivalTime: arrival,
    trafficModel: trafficAware ? toTrafficModel(params.trafficModel) : undefined,
    transitPreferences: travelMode === "TRANSIT" ? toTransitPreferences(params.transitMode, params.transitRoutingPreference) : undefined,
  });

  if (params.forMatrix) {
    return compact({
      ...shared,
      origins: (params.origins || []).map((origin) =>
        compact({ waypoint: toWaypoint(origin), routeModifiers: modifiers })
      ),
      destinations: (params.destinations || []).map((destination) => ({ waypoint: toWaypoint(destination) })),
    });
  }

  return compact({
    ...shared,
    origin: toWaypoint(params.origin || ""),
    destination: toWaypoint(params.destination || ""),
    intermediates: (params.waypoints || []).map(toWaypoint),
    computeAlternativeRoutes: params.alternatives || undefined,
    optimizeWaypointOrder: params.optimizeWaypoints || undefined,
    routeModifiers: modifiers,
  });
}

function matrixElementStatus(element: any): string {
  if (element?.status?.code && element.status.code !== 0) {
    return element.status.code === 5 ? "ZERO_RESULTS" : "ERROR";
  }
  if (element?.condition === "ROUTE_NOT_FOUND") return "ZERO_RESULTS";
  return "OK";
}

export function mapRouteMatrix(
  origins: string[],
  destinations: string[],
  raw: unknown,
  options: { units?: string; trafficAware?: boolean } = {}
): DistanceMatrixData {
  const rows = Array.isArray(raw) ? raw : [];
  const elements: DistanceMatrixElementOut[][] = origins.map(() =>
    destinations.map(() => ({ status: "ZERO_RESULTS" }))
  );
  const distances: DistanceMatrixData["distances"] = origins.map(() => destinations.map(() => null));
  const durations: DistanceMatrixData["durations"] = origins.map(() => destinations.map(() => null));

  for (const item of rows) {
    const oi = item.originIndex ?? 0;
    const di = item.destinationIndex ?? 0;
    if (oi < 0 || di < 0 || oi >= origins.length || di >= destinations.length) continue;
    const status = matrixElementStatus(item);
    const mapped: DistanceMatrixElementOut = { status };
    if (status === "OK") {
      const meters = item.distanceMeters ?? 0;
      const staticSecs = parseDurationSeconds(item.staticDuration || item.duration);
      const trafficSecs = parseDurationSeconds(item.duration);
      mapped.distance = distanceFromMeters(meters, options.units);
      mapped.duration = durationFromSeconds(staticSecs);
      if (options.trafficAware && trafficSecs) {
        mapped.duration_in_traffic = durationFromSeconds(trafficSecs);
      }
      distances[oi][di] = mapped.distance;
      durations[oi][di] = mapped.duration;
    }
    elements[oi][di] = mapped;
  }

  return {
    origin_addresses: origins,
    destination_addresses: destinations,
    elements,
    distances,
    durations,
  };
}

function mapLatLng(location: any): { lat: number; lng: number } | undefined {
  const lat = location?.latLng?.latitude;
  const lng = location?.latLng?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  return { lat, lng };
}

export function mapComputeRoutes(raw: any, options: { units?: string; trafficAware?: boolean } = {}): any {
  const year = new Date().getFullYear();
  const routes = (raw?.routes || []).map((route: any) => {
    const legs = (route.legs || []).map((leg: any) => {
      const staticSecs = parseDurationSeconds(leg.staticDuration || leg.duration);
      const trafficSecs = parseDurationSeconds(leg.duration);
      const mapped: Record<string, unknown> = {
        distance: distanceFromMeters(leg.distanceMeters ?? 0, options.units),
        duration: durationFromSeconds(staticSecs),
        start_location: mapLatLng(leg.startLocation),
        end_location: mapLatLng(leg.endLocation),
      };
      if (options.trafficAware && trafficSecs) {
        mapped.duration_in_traffic = durationFromSeconds(trafficSecs);
      }
      return mapped;
    });

    if (legs.length === 0 && (route.distanceMeters || route.duration)) {
      const staticSecs = parseDurationSeconds(route.staticDuration || route.duration);
      const trafficSecs = parseDurationSeconds(route.duration);
      const synthetic: Record<string, unknown> = {
        distance: distanceFromMeters(route.distanceMeters ?? 0, options.units),
        duration: durationFromSeconds(staticSecs),
      };
      if (options.trafficAware && trafficSecs) {
        synthetic.duration_in_traffic = durationFromSeconds(trafficSecs);
      }
      legs.push(synthetic);
    }

    return {
      summary: route.description || "",
      description: route.description,
      copyrights: `Powered by Google, ©${year} Google`,
      warnings: route.warnings || [],
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      staticDuration: route.staticDuration,
      polyline: route.polyline,
      viewport: route.viewport,
      optimizedIntermediateWaypointIndex: route.optimizedIntermediateWaypointIndex,
      legs,
    };
  });

  return {
    status: routes.length ? "OK" : "ZERO_RESULTS",
    routes,
    geocoded_waypoints: raw?.geocodingResults,
  };
}
