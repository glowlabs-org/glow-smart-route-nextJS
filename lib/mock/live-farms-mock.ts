// MOCK — swap for a real live-farms endpoint (photo + watts + CO2) later.

export interface LiveFarm {
  id: string;
  name: string;
  region: string;
  photoUrl: string;
  watts: number;
  tonsCo2: number;
  liveSince: string;
}

/**
 * Deterministic placeholder farms for the "Live Solar Farms" carousel.
 *
 * `tonsCo2` is held roughly proportional to `watts` (~0.0011 t per W) so the
 * secondary metric reads plausibly without pretending to be audited output.
 * `photoUrl` rotates through the bundled on-brand solar photos under
 * `public/images/sections` so images always load (the real endpoint will carry
 * a per-farm photo).
 */
const FARM_PHOTOS = [
  "/images/sections/panels-array.jpg",
  "/images/sections/flat-field.jpg",
  "/images/sections/residential.jpg",
];

const RAW_FARMS: Omit<LiveFarm, "photoUrl">[] = [
  { id: "shining-missouri", name: "Shining Missouri", region: "MO", watts: 18000, tonsCo2: 20, liveSince: "2025-04-12" },
  { id: "ratan-rajasthan", name: "Ratan Rajasthan", region: "RJ", watts: 15400, tonsCo2: 17, liveSince: "2025-05-03" },
  { id: "clean-grid-project", name: "Clean Grid Project", region: "CO", watts: 12800, tonsCo2: 14, liveSince: "2025-02-21" },
  { id: "chrono-fjord", name: "Chrono Fjord", region: "ID", watts: 10250, tonsCo2: 11, liveSince: "2025-06-09" },
  { id: "copper-mesa", name: "Copper Mesa", region: "UT", watts: 8600, tonsCo2: 9.5, liveSince: "2025-03-17" },
  { id: "tallgrass-flats", name: "Tallgrass Flats", region: "OK", watts: 7200, tonsCo2: 8, liveSince: "2025-01-28" },
  { id: "sunset-everglade", name: "Sunset Everglade", region: "FL", watts: 6100, tonsCo2: 6.7, liveSince: "2025-05-22" },
  { id: "great-lakes-array", name: "Great Lakes Array", region: "MI", watts: 4900, tonsCo2: 5.4, liveSince: "2025-04-30" },
  { id: "marigold-thar", name: "Marigold Thar", region: "RJ", watts: 3800, tonsCo2: 4.2, liveSince: "2025-06-15" },
  { id: "wasatch-ridge", name: "Wasatch Ridge", region: "UT", watts: 2750, tonsCo2: 3, liveSince: "2025-02-08" },
  { id: "ozark-meadow", name: "Ozark Meadow", region: "MO", watts: 1900, tonsCo2: 2.1, liveSince: "2025-03-04" },
  { id: "front-range-rooftop", name: "Front Range Rooftop", region: "CO", watts: 1200, tonsCo2: 1.3, liveSince: "2025-05-11" },
];

export const MOCK_LIVE_FARMS: LiveFarm[] = RAW_FARMS.map((farm, index) => ({
  ...farm,
  photoUrl: FARM_PHOTOS[index % FARM_PHOTOS.length]!,
}));
