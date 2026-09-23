/**
 * District centroids for Kerala.
 *
 * These replace an external geocoding provider entirely. A victim picks a
 * district and types a landmark; the district supplies coordinates. Distances
 * are therefore real and computed, without an API key, a rate limit, or a
 * dependency that fails in an exam hall with no network.
 */
export const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  Kollam:             { lat: 8.8932, lng: 76.6141 },
  Pathanamthitta:     { lat: 9.2648, lng: 76.7870 },
  Alappuzha:          { lat: 9.4981, lng: 76.3388 },
  Kottayam:           { lat: 9.5916, lng: 76.5222 },
  Idukki:             { lat: 9.8497, lng: 76.9800 },
  Ernakulam:          { lat: 10.1081, lng: 76.3517 },
  Thrissur:           { lat: 10.5276, lng: 76.2144 },
  Palakkad:           { lat: 10.7867, lng: 76.6548 },
  Malappuram:         { lat: 11.0510, lng: 76.0711 },
  Kozhikode:          { lat: 11.2588, lng: 75.7804 },
  Wayanad:            { lat: 11.6854, lng: 76.1320 },
  Kannur:             { lat: 11.8745, lng: 75.3704 },
  Kasaragod:          { lat: 12.4996, lng: 74.9869 },
};

export function coordsFor(district: string) {
  return DISTRICT_COORDS[district] ?? DISTRICT_COORDS['Ernakulam'];
}

/** Great-circle distance in kilometres. Mirrors MySQL's ST_Distance_Sphere. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}
