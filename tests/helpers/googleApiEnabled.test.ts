import { isGoogleApiNotEnabled } from "./googleApiEnabled.js";

describe("isGoogleApiNotEnabled", () => {
  it("matches Google legacy-API-not-activated message (REQUEST_DENIED)", () => {
    expect(
      isGoogleApiNotEnabled({
        status: "REQUEST_DENIED",
        error_message:
          "You’re calling a legacy API, which is not enabled for your project. To get newer features and more functionality, switch to the Places API (New) or Routes API. Learn more: https://developers.google.com/maps/legacy#LegacyApiNotActivatedMapError",
      })
    ).toBe(true);
  });

  it("does not skip invalid API key", () => {
    expect(
      isGoogleApiNotEnabled({
        status: "REQUEST_DENIED",
        error_message: "The provided API key is invalid.",
      })
    ).toBe(false);
  });
});
