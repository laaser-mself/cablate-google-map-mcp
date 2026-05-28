import { PlacesSearcher } from "./PlacesSearcher.js";

let instance: PlacesSearcher | null = null;

export function getSharedPlacesSearcher(): PlacesSearcher {
  if (!instance) {
    instance = new PlacesSearcher();
  }
  return instance;
}
