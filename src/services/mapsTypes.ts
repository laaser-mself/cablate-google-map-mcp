export interface McpToolResult<T> {
  ok: boolean;
  tool: string;
  status: string;
  error_message?: string;
  html_attributions?: string[];
  next_page_token?: string;
  data: T;
}

export interface GmapsEnvelope<T> {
  status: string;
  error_message?: string;
  html_attributions?: string[];
  next_page_token?: string;
  data: T;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceDuration {
  value: number;
  text: string;
}

export interface NearbyPlaceOut {
  name?: string;
  place_id?: string;
  address?: string;
  vicinity?: string;
  location?: LatLng;
  rating?: number;
  total_ratings?: number;
  open_now?: boolean;
  price_level?: number;
  business_status?: string;
  types?: string[];
}

export interface SearchNearbyData {
  center: {
    lat: number;
    lng: number;
    formatted_address?: string;
    place_id?: string;
  };
  results: NearbyPlaceOut[];
}

export interface PlacePhotoOut {
  photo_reference?: string;
  height?: number;
  width?: number;
  html_attributions?: string[];
}

export interface PlaceReviewOut {
  rating?: number;
  text?: string;
  time?: number;
  author_name?: string;
  author_url?: string;
  profile_photo_url?: string;
  language?: string;
  relative_time_description?: string;
}

export interface PlaceDetailsData {
  name?: string;
  place_id?: string;
  address?: string;
  location?: LatLng;
  viewport?: { northeast: LatLng; southwest: LatLng };
  rating?: number;
  total_ratings?: number;
  open_now?: boolean;
  opening_hours?: any;
  phone?: string;
  international_phone?: string;
  website?: string;
  price_level?: number;
  photos?: PlacePhotoOut[];
  business_status?: string;
  types?: string[];
  url?: string;
  utc_offset?: number;
  address_components?: any[];
  reviews?: PlaceReviewOut[];
}

export interface GeocodeAlternate {
  formatted_address: string;
  place_id: string;
  location: LatLng;
  location_type?: string;
  types?: string[];
}

export interface GeocodeData {
  location: LatLng;
  formatted_address: string;
  place_id: string;
  location_type?: string;
  types?: string[];
  partial_match?: boolean;
  address_components?: any[];
  viewport?: { northeast: LatLng; southwest: LatLng };
  plus_code?: { global_code?: string; compound_code?: string };
  alternates: GeocodeAlternate[];
}

export interface ReverseGeocodeData {
  formatted_address: string;
  place_id: string;
  address_components: any[];
  geometry?: any;
  types?: string[];
  plus_code?: { global_code?: string; compound_code?: string };
  alternates: GeocodeAlternate[];
}

export interface DistanceMatrixElementOut {
  status: string;
  distance?: DistanceDuration;
  duration?: DistanceDuration;
  duration_in_traffic?: DistanceDuration;
  fare?: { currency: string; value: number; text: string };
}

export interface DistanceMatrixData {
  origin_addresses: string[];
  destination_addresses: string[];
  elements: DistanceMatrixElementOut[][];
  distances: Array<Array<DistanceDuration | null>>;
  durations: Array<Array<DistanceDuration | null>>;
}

export interface DirectionsData {
  routes: any[];
  summary: string;
  total_distance: DistanceDuration;
  total_duration: DistanceDuration;
  duration_in_traffic?: DistanceDuration;
  arrival_time: string;
  departure_time: string;
  geocoded_waypoints?: any[];
  available_travel_modes?: string[];
  copyrights?: string;
  warnings?: string[];
}

export interface ElevationPointOut {
  elevation: number;
  location: LatLng;
  resolution?: number;
}

export type TravelModeName = "driving" | "walking" | "bicycling" | "transit";

export interface MapsRequestOptions {
  language?: string;
  region?: string;
}

export interface SearchNearbyOptions extends MapsRequestOptions {
  type?: string;
  rankBy?: "prominence" | "distance";
  minPrice?: number;
  maxPrice?: number;
  pageToken?: string;
  keyword?: string;
  radius?: number;
  openNow?: boolean;
  minRating?: number;
}

export interface PlaceDetailsOptions extends MapsRequestOptions {
  fields?: string[];
  sessionToken?: string;
}

export interface GeocodeOptions extends MapsRequestOptions {
  address?: string;
  placeId?: string;
  bounds?: { southwest: LatLng; northeast: LatLng };
  components?: string;
  resultIndex?: number;
  includeAlternates?: boolean;
}

export interface ReverseGeocodeOptions extends MapsRequestOptions {
  latitude?: number;
  longitude?: number;
  placeId?: string;
  resultType?: string[];
  locationType?: string[];
  enableAddressDescriptor?: boolean;
  resultIndex?: number;
  includeAlternates?: boolean;
}

export interface DistanceMatrixOptions extends MapsRequestOptions {
  departureTime?: string;
  arrivalTime?: string;
  trafficModel?: string;
  avoid?: string[];
  units?: string;
  transitMode?: string[];
  transitRoutingPreference?: string;
}

export interface DirectionsOptions extends MapsRequestOptions {
  waypoints?: string[];
  alternatives?: boolean;
  optimizeWaypoints?: boolean;
  avoid?: string[];
  departureTime?: string;
  arrivalTime?: string;
  trafficModel?: string;
  units?: string;
  transitMode?: string[];
  transitRoutingPreference?: string;
}

export interface ElevationOptions {
  locations?: Array<{ latitude: number; longitude: number }>;
  path?: Array<{ latitude: number; longitude: number }>;
  samples?: number;
}

export const DEFAULT_PLACE_DETAILS_FIELDS = [
  "name",
  "place_id",
  "rating",
  "formatted_address",
  "opening_hours",
  "reviews",
  "geometry",
  "formatted_phone_number",
  "international_phone_number",
  "website",
  "price_level",
  "photos",
  "business_status",
  "types",
  "url",
  "utc_offset",
  "address_components",
  "user_ratings_total",
];
