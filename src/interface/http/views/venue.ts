/** Public identity of the venue shown on every page (single source of truth for name and address). */
export const VENUE = {
  name: "Arena",
  city: "Capão Bonito/SP",
  address: "R. Boulevard, 280 - Terras do Imbirucu, Capão Bonito - SP",
} as const;

const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";

export const VENUE_MAPS_URL: string = `${GOOGLE_MAPS_SEARCH_URL}${encodeURIComponent(VENUE.address)}`;
