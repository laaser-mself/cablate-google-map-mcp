# GUIDE-0.2.0 — MCP Google Maps envelope, return-shape parity, tests

| Version | Date | Author | Notes | Tools used |
|---|---|---|---|---|
| 0.2.0 | 2026-08-19 | MRS | **Envelope + GMaps return parity** for 7 tools; optional MCP args; Jest unit + live GMaps + MCP E2E; Place Details photos fix; directions no longer force `departure_time=now`; **omit unset GMaps params**; **Routes API v2** for Distance Matrix + Directions (legacy endpoints blocked on new GCP projects); Elevation remains Elevation API | Cursor |

**Branch:** `MRS_AUGMENT_MCP_STRUCTURES_20260819`  
**Prior:** `0.0.14` / multitenant HTTP server (`MRS_MULTITENANT_20260528`)

---

## What changed (returning readers)

| Area | Change |
|---|---|
| Response contract | Every tool now returns `McpToolResult` JSON (`ok`, `tool`, `status`, optional `error_message` / `html_attributions` / `next_page_token`, `data`) |
| Place Details (P0) | `photos`, `place_id`, full `opening_hours`, review extras, envelope attributions — previously requested but dropped |
| Geocode / reverse | Full result set; primary + `alternates[]`; `address_components`, geometry, `plus_code` |
| Distance matrix | **Routes API** `computeRouteMatrix`; per-element `status`; optional `duration_in_traffic` when `departureTime` set; `origin_addresses`/`destination_addresses` are the request strings (Routes does not reverse-geocode) |
| Directions | **Routes API** `computeRoutes`; totals summed across **all legs**; `copyrights` synthesized (`Powered by Google, ©YEAR Google`); **no default departure=now**; `TRAFFIC_UNAWARE` unless `departureTime` is set |
| Nearby | `data` is `{ center, results }` (**breaking**); extra fields + `next_page_token` |
| Elevation | `resolution` per point; optional path+samples mode |
| MCP inputs | Optional `language`/`region` and per-tool GMaps params (all optional except XOR rules) |
| Tests | `npm test` (mocked); `npm run test:integration` (live + MCP E2E). Matrix/Directions skip if **Routes API** is not enabled; Elevation skip if Elevation API is not enabled. Places + Geocoding remain required. |
| HTTP server | `startHttpServer(0)` returns the bound port (E2E only) |
| Session expiry (**fix**) | Idle TTL default **30 s → 30 min**. A voice caller routinely goes >30 s between tool calls, so the sweeper reaped live sessions mid-conversation. |
| Session 404 (**fix**) | An unknown/expired `Mcp-Session-Id` now returns **404**, not 400. Streamable HTTP requires 404 — it is the signal for the client to re-issue `InitializeRequest`. A 400 leaves the client wedged for the rest of the call. Missing header on a non-initialize request still returns 400 per spec. |
| GMaps client params | Omit `undefined`/`null`/empty-string keys before calling `@googlemaps/google-maps-services-js`; the client serializer throws `Cannot read properties of undefined (reading 'southwest')` if `bounds` is present but unset. Catch logs message only (do not dump Axios config — it contains `key`). |

---

## Standard envelope

Defined in `src/services/mapsTypes.ts`, built by `src/services/mapsResponse.ts`.

```typescript
interface McpToolResult<T> {
  ok: boolean;
  tool: string;                 // e.g. "maps_geocode"
  status: string;               // GMaps Status: OK | ZERO_RESULTS | ...
  error_message?: string;
  html_attributions?: string[];
  next_page_token?: string;
  data: T;
}
```

MCP `content[0].text` is pretty-printed JSON of that object. `isError` is `!ok`.

`ok` is true for GMaps `OK` and `ZERO_RESULTS`.

---

## Layer map

| File | Role |
|---|---|
| `src/services/toolclass.ts` | GMaps param assembly, raw call, envelope + raw/normalized payload |
| `src/services/PlacesSearcher.ts` | Typed `data` contract; no silent field drops |
| `src/tools/maps/*.ts` | Zod shape + `.superRefine` in ACTION; `toMcpContent` |
| `src/tools/maps/commonSchema.ts` | Shared `language` / `region` |
| `src/core/BaseMcpServer.ts` | Unchanged session model; returns bound port from listen |

---

## Per-tool modifications

### `search_nearby`

**Request (new optional):** `type`, `rankBy` (`prominence`\|`distance`), `minPrice`, `maxPrice`, `pageToken`, `language`, `region`. `radius` no longer defaults in Zod (API layer still uses 1000 unless `rankBy=distance`).

**Validation:** `rankBy=distance` requires `keyword` or `type`; cannot combine with `radius`.

**Return `data` (breaking):**

```json
{
  "center": { "lat": 25.76, "lng": -80.19 },
  "results": [{ "name": "...", "place_id": "...", "vicinity": "...", "types": ["cafe"], "business_status": "OPERATIONAL", "price_level": 2 }]
}
```

Envelope may include `next_page_token`, `html_attributions`.

### `get_place_details`

**Request:** default `fields[]` expanded (`photos`, `place_id`, `international_phone_number`, `business_status`, `types`, `url`, `utc_offset`, `address_components`, …). Optional caller `fields[]` (must be non-empty), `sessionToken`, `language`, `region`.

**Return `data` now includes:** `place_id`, `photos`, `viewport`, full `opening_hours`, `international_phone`, `business_status`, `types`, `url`, `utc_offset`, `address_components`. Reviews add `author_url`, `profile_photo_url`, `language`, `relative_time_description`. Envelope `html_attributions`.

### `maps_geocode`

**Request:** one of `address` / `placeId` / `components`. Optional `bounds`, `resultIndex`, `includeAlternates` (default true), `language`, `region`.

**Return `data`:** primary match plus `location_type`, `types`, `partial_match`, `address_components`, `viewport`, `plus_code`, `alternates[]`.

### `maps_reverse_geocode`

**Request:** `(latitude` AND `longitude)` OR `placeId`. Optional `resultType[]`, `locationType[]`, `enableAddressDescriptor`, `resultIndex`, `includeAlternates`.

**Return `data`:** previous fields plus `geometry`, `types`, `plus_code`, `alternates[]`.

### `maps_distance_matrix`

**Backend:** Routes API `POST /distanceMatrix/v2:computeRouteMatrix` (not the legacy Distance Matrix endpoint).

**Request optional:** `departureTime`, `arrivalTime` (XOR), `trafficModel`, `avoid[]`, `units`, `transitMode[]`, `transitRoutingPreference`, `language`, `region`. Driving without `departureTime` uses `TRAFFIC_UNAWARE`.

**Return `data`:** `elements[][]` with `status` and optional distance/duration/traffic. Legacy `distances` / `durations` matrices still present (null when element status ≠ OK). `origin_addresses` / `destination_addresses` echo the request strings.

### `maps_directions`

**Backend:** Routes API `POST /directions/v2:computeRoutes`.

**Behavior:** `departureTime` is **not** defaulted to now. Omit unless you want traffic-aware routing (`TRAFFIC_AWARE`). Legacy `departure_time` / `arrival_time` aliases still accepted.

**Request optional:** `waypoints[]`, `alternatives`, `optimizeWaypoints`, `avoid[]`, times, `trafficModel`, `units`, transit options, `language`, `region`. Times XOR.

**Return `data`:** `total_distance` / `total_duration` summed across all legs; `duration_in_traffic` when traffic-aware; `copyrights` (`Powered by Google, ©YEAR Google` — Routes does not return copyrights); `warnings`. `routes[]` also carries Routes-native fields (`description`, `distanceMeters`, `polyline`, `viewport`).

### `maps_elevation`

**Request:** exactly one of `locations` or (`path` + `samples`).

**Return:** each point includes `resolution`.

---

## Tests

| Command | What | API key |
|---|---|---|
| `npm test` | Unit: envelope, `GoogleMapsTools` (mocked Client + Routes client), `PlacesSearcher`, 7 ACTION handlers, Zod adversarial | Not required |
| `npm run test:integration` | Live atomic GMaps calls + MCP E2E (real `BaseMcpServer` + SDK StreamableHTTP client, `tools/call` × 7) | Required; **prompts** if missing. `CI=true` fails fast |

Key files:

- `tests/services/*.test.ts`
- `tests/tools/maps/*.test.ts`
- `tests/schemas/validation.test.ts`
- `tests/integration/maps.live.test.ts`
- `tests/e2e/mcpServer.e2e.test.ts`
- `tests/helpers/mockMcpClient.ts`, `mcpTestServer.ts`, `requireGmapsApiKey.ts`
- `scripts/run-integration-tests.js`

---

## Deploy notes (after pull)

1. Node ≥ 18 (`nvm use` if `.nvmrc` is present).
2. `npm ci` / `npm install`
3. `npm test`
4. `npm run build`
5. Enable in GCP: **Places**, **Geocoding**, **Routes API**, and **Elevation API**. Then `npm run test:integration`. Matrix/Directions skip if Routes is not enabled; Elevation skip if Elevation is not enabled. Do **not** enable the legacy Distance Matrix / Directions APIs — this server no longer calls them.
6. **Update the deployed `.env`:** if it carries `MCP_SESSION_IDLE_MS=30000` from a prior release, raise it (`1800000`) or delete the line. The env var overrides the new code default, so an untouched `.env` reproduces the mid-call `No valid session ID provided` failure.
7. Restart the MCP process; clients must handle `search_nearby` `{ center, results }` and the envelope wrapper.

---

## Session expiry defect (observed 2026-08-19)

Packet capture from `gm-mcp-1.laaserapi.com` showed an ElevenLabs agent losing its session mid-call:

```
POST /mcp   Mcp-Session-Id: bd79df38-0240-432b-8e13-90667ebefa32
            {"method":"tools/call","params":{"name":"maps_reverse_geocode",...}}
HTTP/1.1 400 Bad Request
            {"error":{"code":-32000,"message":"Bad Request: No valid session ID provided"}}
```

Two defects, both fixed:

1. **Premature reap.** `MCP_SESSION_IDLE_MS` defaulted to 30 s, swept every 60 s. The caller talks for longer than that between tool calls, so the session was gone before the next call arrived.
2. **Unrecoverable status.** The server answered 400. Streamable HTTP mandates **404** for a terminated session ID, and a 404 is what tells the client to re-initialize. With a 400 the agent stays broken for the remainder of the call.

If sessions must be reaped aggressively, item 2 alone makes the failure self-healing on a spec-compliant client. Item 1 avoids the round trip entirely.

**Horizontal scaling caveat:** sessions live in process memory. More than one replica behind the load balancer will produce the same 404 whenever a request lands on a different instance. Keep this service single-instance, or add sticky sessions on `Mcp-Session-Id`, until session state is externalized.

Regression coverage: `tests/core/sessionLifecycle.test.ts`.

---

## Intentionally unchanged

- Per-session `McpServer` + max session limit from the multitenant branch
- No new GMaps products (Autocomplete, Text Search, Timezone, Roads) — Phase 3 backlog
