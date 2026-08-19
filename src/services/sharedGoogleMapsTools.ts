import { GoogleMapsTools } from "./toolclass.js";

let instance: GoogleMapsTools | null = null;

export function getSharedGoogleMapsTools(): GoogleMapsTools {
  if (!instance) {
    instance = new GoogleMapsTools();
  }
  return instance;
}

export function setSharedGoogleMapsTools(tools: GoogleMapsTools | null): void {
  instance = tools;
}
