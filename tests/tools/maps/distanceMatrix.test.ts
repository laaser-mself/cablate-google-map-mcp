import { DistanceMatrix } from "../../../src/tools/maps/distanceMatrix.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("maps_distance_matrix ACTION", () => {
  it("includes element status", async () => {
    mockSearcher({
      calculateDistanceMatrix: jest.fn().mockResolvedValue({
        ok: true,
        tool: "maps_distance_matrix",
        status: "OK",
        data: { origin_addresses: ["A"], destination_addresses: ["B"], elements: [[{ status: "OK" }]], distances: [[]], durations: [[]] },
      }),
    });
    const result = await DistanceMatrix.ACTION({ origins: ["A"], destinations: ["B"], mode: "driving" });
    expect(parseAction(result).data.elements[0][0].status).toBe("OK");
  });

  it("sets isError on failure", async () => {
    mockSearcher({
      calculateDistanceMatrix: jest.fn().mockResolvedValue({
        ok: false,
        tool: "maps_distance_matrix",
        status: "ERROR",
        error_message: "failed",
        data: null,
      }),
    });
    expect((await DistanceMatrix.ACTION({ origins: ["A"], destinations: ["B"], mode: "driving" })).isError).toBe(true);
  });
});
