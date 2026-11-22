import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const { findRates, reserve, getPublications, previewAllowed } = vi.hoisted(() => ({
  findRates: vi.fn(),
  reserve: vi.fn(),
  getPublications: vi.fn(),
  previewAllowed: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    airportTransferPricing: { findUnique: findRates },
    $transaction: vi.fn(async (operation) => operation({ $queryRaw: reserve })),
  },
}));
vi.mock("@/lib/publication", () => ({ getPublications }));
vi.mock("@/lib/soft-launch", () => ({ publicPreviewAllowed: previewAllowed }));

const token = "55cb5b18-56d3-42ac-893a-acab45440714";
const example = { kind: "estimate", placeId: "ChIJ-hotel", sessionToken: token, direction: "TO_AIRPORT", passengers: 2, time: "10:45" };
const request = (data: object, site = "same-origin") => new Request("http://localhost/api/transfers/map", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Sec-Fetch-Site": site },
  body: JSON.stringify(data),
});
const fetchGoogle = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchGoogle);
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "unit-test-key");
  vi.stubEnv("GOOGLE_MAPS_KGL_PLACE_ID", "ChIJ-kgl");
  vi.stubEnv("TRANSFER_ROUTE_ESTIMATES_ENABLED", "true");
  getPublications.mockResolvedValue({ TRANSPORT: "ENQUIRY" });
  previewAllowed.mockResolvedValue(true);
  findRates.mockResolvedValue({
    isActive: true,
    rates: {
      supplierRwf: { FROM_AIRPORT: [8000, 13000, 20000], TO_AIRPORT: [7500, 11000, 18000] },
      dispatchRwf: 1000, nightRwf: 2000, paymentBps: 200, contributionBps: 2200,
      validThrough: "2099-12-31", evidence: "Test only rate card",
    },
  });
  reserve.mockResolvedValue([{ count: 3 }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("completes the Places session and uses the directed road route to price server-side", async () => {
  fetchGoogle.mockResolvedValueOnce(Response.json({ location: {} }))
    .mockResolvedValueOnce(Response.json({ routes: [{ distanceMeters: 12000, duration: "1081s" }] }));
  const response = await POST(request({ ...example, fareRwf: 1, distanceMeters: 1 }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ distanceMeters: 12000, durationMinutes: 19, fareRwf: 16000 });
  expect(fetchGoogle.mock.calls[0][0]).toContain(`/places/ChIJ-hotel?sessionToken=${token}`);
  expect(JSON.parse(fetchGoogle.mock.calls[1][1].body)).toMatchObject({
    origin: { placeId: "ChIJ-hotel" }, destination: { placeId: "ChIJ-kgl" }, travelMode: "DRIVE",
  });
});

it("lists Rwanda place suggestions with the session token and server-side key", async () => {
  fetchGoogle.mockResolvedValueOnce(Response.json({
    suggestions: [{ placePrediction: { placeId: "ChIJ-hotel", text: { text: "A hotel, Kigali" } } }],
  }));
  const response = await POST(request({ kind: "places", input: "Kigali hotel", sessionToken: token }));
  expect(await response.json()).toEqual({ places: [{ placeId: "ChIJ-hotel", label: "A hotel, Kigali" }] });
  expect(JSON.parse(fetchGoogle.mock.calls[0][1].body)).toMatchObject({ includedRegionCodes: ["rw"], sessionToken: token });
});

it("skips Google on cross-site, private preview, disabled or rate-limited requests", async () => {
  expect((await POST(request(example, "cross-site"))).status).toBe(403);
  expect((await POST(request({ ...example, time: "29:05" }))).status).toBe(400);
  previewAllowed.mockResolvedValueOnce(false);
  expect((await POST(request(example))).status).toBe(404);
  findRates.mockResolvedValueOnce({ isActive: false });
  expect((await POST(request(example))).status).toBe(404);
  reserve.mockResolvedValueOnce([]);
  expect((await POST(request(example))).status).toBe(429);
  vi.stubEnv("TRANSFER_ROUTE_ESTIMATES_ENABLED", "false");
  expect((await POST(request(example))).status).toBe(404);
  expect(fetchGoogle).not.toHaveBeenCalled();
});

it("offers the desk for long or unmapped routes and handles Maps errors", async () => {
  const direct = { ...example, sessionToken: undefined };
  fetchGoogle.mockResolvedValueOnce(Response.json({ routes: [{ distanceMeters: 25001, duration: "1800s" }] }));
  expect((await POST(request(direct))).status).toBe(422);
  fetchGoogle.mockResolvedValueOnce(Response.json({ routes: [] }));
  expect((await POST(request(direct))).status).toBe(422);
  fetchGoogle.mockResolvedValueOnce(Response.json({}, { status: 403 }));
  expect((await POST(request(direct))).status).toBe(503);
});
