import { NextRequest, NextResponse } from "next/server";
import {
  AVAILABLE_COUNTRIES,
  MOCK_FLIGHTS,
  searchMockFlights,
} from "@/lib/mock-flights";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const showAll = params.get("all") === "true";
  const flightNumber =
    params.get("flightNumber") ?? params.get("q") ?? "";
  const fromCountry = params.get("fromCountry") ?? "";
  const toCountry = params.get("toCountry") ?? "";
  const fromAirport = params.get("fromAirport") ?? "";
  const toAirport = params.get("toAirport") ?? "";
  const season = params.get("season") ?? "";

  const trimmedQuery = flightNumber.trim();
  const trimmedFrom = fromCountry.trim();
  const trimmedTo = toCountry.trim();
  const trimmedFromAirport = fromAirport.trim();
  const trimmedToAirport = toAirport.trim();
  const trimmedSeason = season.trim();

  if (showAll) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return NextResponse.json({
      query: "ALL",
      fromCountry: "All",
      toCountry: "All",
      fromAirport: "All",
      toAirport: "All",
      season: "All",
      countries: AVAILABLE_COUNTRIES,
      count: MOCK_FLIGHTS.length,
      flights: MOCK_FLIGHTS,
    });
  }

  const hasCountryFilter =
    (trimmedFrom && trimmedFrom.toLowerCase() !== "all") ||
    (trimmedTo && trimmedTo.toLowerCase() !== "all");
  const hasAirportFilter =
    (trimmedFromAirport && trimmedFromAirport.toLowerCase() !== "all") ||
    (trimmedToAirport && trimmedToAirport.toLowerCase() !== "all");
  const hasSeasonFilter =
    trimmedSeason && trimmedSeason.toLowerCase() !== "all";

  if (!trimmedQuery && !hasCountryFilter && !hasAirportFilter && !hasSeasonFilter) {
    return NextResponse.json(
      {
        error:
          "Please select a country/airport or enter a flight number to search.",
        flights: [],
      },
      { status: 400 }
    );
  }

  // Simulate realistic API latency
  await new Promise((resolve) => setTimeout(resolve, 180));

  const flights = searchMockFlights({
    query: trimmedQuery,
    fromCountry: trimmedFrom,
    toCountry: trimmedTo,
    fromAirport: trimmedFromAirport,
    toAirport: trimmedToAirport,
    season: trimmedSeason,
  });

  return NextResponse.json({
    query: trimmedQuery,
    fromCountry: trimmedFrom || "All",
    toCountry: trimmedTo || "All",
    fromAirport: trimmedFromAirport || "All",
    toAirport: trimmedToAirport || "All",
    season: trimmedSeason || "All",
    countries: AVAILABLE_COUNTRIES,
    count: flights.length,
    flights,
  });
}
