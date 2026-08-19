import { PlacesSearcher } from "../../src/services/PlacesSearcher.js";
import { setSharedPlacesSearcher } from "../../src/services/sharedPlacesSearcher.js";
import { McpToolResult } from "../../src/services/mapsTypes.js";

export function mockSearcher(partial: Partial<PlacesSearcher>): PlacesSearcher {
  const searcher = partial as PlacesSearcher;
  setSharedPlacesSearcher(searcher);
  return searcher;
}

export function parseAction(result: { content: Array<{ text: string }>; isError?: boolean }): McpToolResult<any> {
  return JSON.parse(result.content[0].text);
}

export function afterEachResetSearcher(): void {
  setSharedPlacesSearcher(null);
}
