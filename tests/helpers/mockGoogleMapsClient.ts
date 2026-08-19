export function createMockGoogleMapsClient(overrides: Record<string, jest.Mock> = {}) {
  return {
    placesNearby: jest.fn(),
    placeDetails: jest.fn(),
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
    distancematrix: jest.fn(),
    directions: jest.fn(),
    elevation: jest.fn(),
    ...overrides,
  };
}

export function createMockRoutesClient(overrides: Record<string, jest.Mock> = {}) {
  return {
    computeRoutes: jest.fn(),
    computeRouteMatrix: jest.fn(),
    ...overrides,
  };
}
