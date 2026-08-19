import { Directions } from "../../../src/tools/maps/directions.js";
import { afterEachResetSearcher, mockSearcher, parseAction } from "../../helpers/mockPlacesSearcher.js";

afterEach(afterEachResetSearcher);

describe("maps_directions ACTION", () => {
  it("returns routes and copyrights", async () => {
    mockSearcher({
      getDirections: jest.fn().mockResolvedValue({
        ok: true,
        tool: "maps_directions",
        status: "OK",
        data: {
          routes: [{}],
          summary: "I-95",
          total_distance: { value: 300, text: "300 m" },
          total_duration: { value: 30, text: "30 s" },
          arrival_time: "",
          departure_time: "",
          copyrights: "Map data © Google",
        },
      }),
    });
    const result = await Directions.ACTION({ origin: "A", destination: "B", mode: "driving" });
    const body = parseAction(result);
    expect(body.data.total_distance.value).toBe(300);
    expect(body.data.copyrights).toContain("Google");
  });

  it("sets isError on failure", async () => {
    mockSearcher({
      getDirections: jest.fn().mockResolvedValue({
        ok: false,
        tool: "maps_directions",
        status: "ERROR",
        error_message: "failed",
        data: null,
      }),
    });
    expect((await Directions.ACTION({ origin: "A", destination: "B", mode: "driving" })).isError).toBe(true);
  });
});
