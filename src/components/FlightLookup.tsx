"use client";

import { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import {
  Search,
  Plane,
  PlaneTakeoff,
  PlaneLanding,
  Clock,
  MapPin,
  Globe,
  X,
  AlertCircle,
  Sparkles,
  History,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowLeftRight,
  SlidersHorizontal,
  Tag,
  Sun,
} from "lucide-react";
import {
  AVAILABLE_COUNTRIES,
  MOCK_FLIGHTS,
  getDepartureAirports,
  getArrivalAirports,
  searchMockFlights,
  formatTimeZoneDelta,
  type Flight,
  type FlightStatus,
  type TravelSeason,
} from "@/lib/mock-flights";

type SortMode = "best" | "fare" | "departure" | "duration";
type TimeWindow = "all" | "morning" | "afternoon" | "evening";

interface CountryCorridor {
  from: string;
  fromAirport?: string;
  to: string;
  toAirport?: string;
  label: string;
  tag?: string;
  season?: TravelSeason | "All";
  sortBy?: SortMode;
}

const POPULAR_CORRIDORS: CountryCorridor[] = [
  {
    from: "Australia",
    fromAirport: "SYD",
    to: "Bangladesh",
    toAirport: "DAC",
    label: "Sydney (SYD) → Bangladesh (DAC)",
    tag: "Best Deals",
    sortBy: "fare",
  },
  {
    from: "Australia",
    fromAirport: "All",
    to: "Bangladesh",
    toAirport: "DAC",
    label: "All Australia Airports → Bangladesh",
    tag: "SYD/MEL/PER/BNE/ADL",
    sortBy: "fare",
  },
  {
    from: "Bangladesh",
    fromAirport: "DAC",
    to: "All",
    toAirport: "All",
    label: "Bangladesh → Anywhere",
    tag: "Summer Deals",
    season: "Summer (May–Sep)",
    sortBy: "fare",
  },
  {
    from: "Bangladesh",
    fromAirport: "DAC",
    to: "All",
    toAirport: "All",
    label: "Bangladesh → Anywhere",
    tag: "All Seasons",
    season: "All",
    sortBy: "fare",
  },
  {
    from: "United States",
    to: "United Kingdom",
    label: "United States → United Kingdom",
  },
];

const SEASON_OPTIONS: { id: TravelSeason | "All"; label: string }[] = [
  { id: "All", label: "All Seasons" },
  { id: "Summer (May–Sep)", label: "Summer (May–Sep)" },
  { id: "Shoulder (Feb–Mar / Sep–Oct)", label: "Shoulder (Feb–Mar / Sep–Oct)" },
  { id: "Winter (Nov–Feb)", label: "Winter (Nov–Feb)" },
  { id: "Year-Round", label: "Year-Round" },
];

const SAMPLE_FLIGHT_NUMBERS = ["CZ326", "OD172", "TG472", "BS213", "UA123"];

const STATUS_STYLES: Record<
  FlightStatus,
  { badge: string; dot: string }
> = {
  "On Time": {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  "In Air": {
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
  },
  Boarding: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
  },
  Delayed: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
  Scheduled: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-400",
  },
};

const AIRLINE_ACCENTS: Record<string, string> = {
  CZ: "from-sky-600 to-blue-800",
  OD: "from-rose-600 to-amber-600",
  MH: "from-blue-700 to-indigo-900",
  SQ: "from-amber-500 to-indigo-900",
  TG: "from-purple-700 to-fuchsia-700",
  "6E": "from-indigo-600 to-blue-800",
  BG: "from-emerald-700 to-rose-700",
  BS: "from-blue-700 to-sky-600",
  AK: "from-red-600 to-rose-700",
  UL: "from-sky-700 to-teal-700",
  FZ: "from-sky-600 to-orange-600",
  UA: "from-blue-600 to-indigo-700",
  DL: "from-rose-600 to-slate-900",
  AA: "from-sky-600 to-rose-600",
  BA: "from-indigo-700 to-rose-700",
  VS: "from-fuchsia-700 to-rose-600",
  LH: "from-amber-500 to-slate-900",
  AF: "from-blue-700 to-rose-600",
  JL: "from-red-600 to-slate-900",
  NH: "from-sky-700 to-blue-900",
  EK: "from-red-700 to-amber-600",
  AC: "from-red-600 to-slate-800",
  QF: "from-rose-600 to-red-800",
  AI: "from-orange-600 to-rose-700",
  TK: "from-red-600 to-rose-900",
};

const RECENT_STORAGE_KEY = "skypulse_recent_searches_v4";

interface SearchResponse {
  query: string;
  fromCountry: string;
  toCountry: string;
  fromAirport: string;
  toAirport: string;
  count: number;
  flights: Flight[];
  error?: string;
}

function getDepartureHour(isoTime: string): number {
  const match = isoTime.match(/T(\d{2}):/);
  return match ? Number.parseInt(match[1], 10) : 12;
}

function matchesTimeWindow(flight: Flight, window: TimeWindow): boolean {
  if (window === "all") return true;
  const hour = getDepartureHour(flight.departure.isoTime);
  if (window === "morning") return hour >= 5 && hour < 12;
  if (window === "afternoon") return hour >= 12 && hour < 17;
  return hour >= 17 || hour < 5;
}

export default function FlightLookup() {
  const [fromCountry, setFromCountry] = useState("All");
  const [fromAirport, setFromAirport] = useState("All");
  const [toCountry, setToCountry] = useState("All");
  const [toAirport, setToAirport] = useState("All");
  const [flightNumber, setFlightNumber] = useState("");

  const [results, setResults] = useState<Flight[] | null>(null);
  const [searchLabel, setSearchLabel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState<FlightStatus | "All">("All");
  const [seasonFilter, setSeasonFilter] = useState<TravelSeason | "All">("All");
  const [airlineFilter, setAirlineFilter] = useState<string>("All");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [sortMode, setSortMode] = useState<SortMode>("best");

  const searchContainerRef = useRef<HTMLDivElement>(null);

  const availableFromAirports = useMemo(
    () => getDepartureAirports(fromCountry),
    [fromCountry]
  );

  const availableToAirports = useMemo(
    () => getArrivalAirports(toCountry),
    [toCountry]
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 5));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const liveSuggestions = useMemo(() => {
    const trimmed = flightNumber.trim();
    const scoped = searchMockFlights({
      query: trimmed || undefined,
      fromCountry,
      toCountry,
      fromAirport,
      toAirport,
    });
    if (scoped.length > 0) return scoped.slice(0, 6);
    if (
      !trimmed &&
      fromCountry === "All" &&
      toCountry === "All" &&
      fromAirport === "All" &&
      toAirport === "All"
    ) {
      return MOCK_FLIGHTS.slice(0, 6);
    }
    return [];
  }, [flightNumber, fromCountry, toCountry, fromAirport, toAirport]);

  function saveRecentSearch(label: string) {
    if (!label || label === "All Scheduled Flights") return;
    setRecentSearches((prev) => {
      const next = [label, ...prev.filter((item) => item !== label)].slice(
        0,
        5
      );
      try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  function resetFilters(
    nextSeason: TravelSeason | "All" = "All",
    nextSort: SortMode = "best"
  ) {
    setStatusFilter("All");
    setSeasonFilter(nextSeason);
    setAirlineFilter("All");
    setTimeWindow("all");
    setSortMode(nextSort);
  }

  function buildSearchSummaryLabel(
    query: string,
    fromC: string,
    fromA: string,
    toC: string,
    toA: string
  ): string {
    const parts: string[] = [];
    const hasRoute =
      fromC !== "All" || toC !== "All" || fromA !== "All" || toA !== "All";
    if (hasRoute) {
      const fromText =
        fromA !== "All"
          ? `${fromC === "All" ? "" : `${fromC} `}(${fromA})`.trim()
          : fromC === "All"
          ? "Any Country"
          : fromC;
      const toText =
        toA !== "All"
          ? `${toC === "All" ? "" : `${toC} `}(${toA})`.trim()
          : toC === "All"
          ? "Anywhere"
          : toC;
      parts.push(`${fromText} → ${toText}`);
    }
    if (query) {
      parts.push(`#${query.toUpperCase()}`);
    }
    return parts.join(" · ");
  }

  async function runSearch(override?: {
    query?: string;
    from?: string;
    fromAirport?: string;
    to?: string;
    toAirport?: string;
    browseAll?: boolean;
    initialSeason?: TravelSeason | "All";
    initialSort?: SortMode;
  }) {
    const browseAll = override?.browseAll ?? false;
    const query = (override?.query ?? flightNumber).trim();
    const from = override?.from ?? fromCountry;
    const fromAp = override?.fromAirport ?? fromAirport;
    const to = override?.to ?? toCountry;
    const toAp = override?.toAirport ?? toAirport;

    const hasCountryOrAirport =
      from !== "All" || to !== "All" || fromAp !== "All" || toAp !== "All";
    if (!browseAll && !query && !hasCountryOrAirport) {
      setError(
        "Select a country/airport or enter a flight number (e.g. CZ326, UA123)."
      );
      setResults(null);
      setSearchLabel("");
      return;
    }

    setShowSuggestions(false);
    setActiveSuggestionIdx(-1);
    setIsLoading(true);
    setError(null);
    resetFilters(override?.initialSeason ?? "All", override?.initialSort ?? "best");

    try {
      const searchParams = new URLSearchParams();
      if (browseAll) {
        searchParams.set("all", "true");
      } else {
        if (query) searchParams.set("flightNumber", query);
        if (from !== "All") searchParams.set("fromCountry", from);
        if (fromAp !== "All") searchParams.set("fromAirport", fromAp);
        if (to !== "All") searchParams.set("toCountry", to);
        if (toAp !== "All") searchParams.set("toAirport", toAp);
      }

      const response = await fetch(`/api/flights?${searchParams.toString()}`);
      const data: SearchResponse = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to fetch flight details.");
        setResults(null);
        return;
      }

      setResults(data.flights);
      const label = browseAll
        ? "All Scheduled Flights"
        : buildSearchSummaryLabel(query, from, fromAp, to, toAp);
      setSearchLabel(label);
      if (!browseAll && query) {
        saveRecentSearch(query.toUpperCase());
      }
    } catch {
      setError("Network error while looking up flights. Please try again.");
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFromCountryChange(nextCountry: string) {
    setFromCountry(nextCountry);
    const validAirports = getDepartureAirports(nextCountry);
    if (
      fromAirport !== "All" &&
      !validAirports.some((a) => a.code === fromAirport)
    ) {
      setFromAirport("All");
    }
  }

  function handleToCountryChange(nextCountry: string) {
    setToCountry(nextCountry);
    const validAirports = getArrivalAirports(nextCountry);
    if (
      toAirport !== "All" &&
      !validAirports.some((a) => a.code === toAirport)
    ) {
      setToAirport("All");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  function handleSwapCountries() {
    const nextFrom = toCountry;
    const nextTo = fromCountry;
    const nextFromAp = toAirport;
    const nextToAp = fromAirport;
    setFromCountry(nextFrom);
    setToCountry(nextTo);
    setFromAirport(nextFromAp);
    setToAirport(nextToAp);
    if (
      nextFrom !== "All" ||
      nextTo !== "All" ||
      nextFromAp !== "All" ||
      nextToAp !== "All" ||
      flightNumber.trim()
    ) {
      void runSearch({
        from: nextFrom,
        to: nextTo,
        fromAirport: nextFromAp,
        toAirport: nextToAp,
      });
    }
  }

  function handleSelectCorridor(corridor: CountryCorridor) {
    const nextFromAp = corridor.fromAirport ?? "All";
    const nextToAp = corridor.toAirport ?? "All";
    setFromCountry(corridor.from);
    setFromAirport(nextFromAp);
    setToCountry(corridor.to);
    setToAirport(nextToAp);
    setFlightNumber("");
    void runSearch({
      from: corridor.from,
      fromAirport: nextFromAp,
      to: corridor.to,
      toAirport: nextToAp,
      query: "",
      initialSeason: corridor.season ?? "All",
      initialSort: corridor.sortBy ?? "best",
    });
  }

  function handleQuickFlight(code: string) {
    setFromCountry("All");
    setFromAirport("All");
    setToCountry("All");
    setToAirport("All");
    setFlightNumber(code);
    void runSearch({
      from: "All",
      fromAirport: "All",
      to: "All",
      toAirport: "All",
      query: code,
    });
  }

  function handleClearAll() {
    setFromCountry("All");
    setFromAirport("All");
    setToCountry("All");
    setToAirport("All");
    setFlightNumber("");
    setResults(null);
    setSearchLabel("");
    setError(null);
    resetFilters();
    setActiveSuggestionIdx(-1);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || liveSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIdx((prev) =>
        prev < liveSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIdx((prev) =>
        prev > 0 ? prev - 1 : liveSuggestions.length - 1
      );
    } else if (e.key === "Enter" && activeSuggestionIdx >= 0) {
      e.preventDefault();
      const picked = liveSuggestions[activeSuggestionIdx];
      setFlightNumber(picked.flightNumber);
      setFromCountry("All");
      setFromAirport("All");
      setToCountry("All");
      setToAirport("All");
      void runSearch({
        from: "All",
        fromAirport: "All",
        to: "All",
        toAirport: "All",
        query: picked.flightNumber,
      });
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIdx(-1);
    }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: results?.length ?? 0 };
    for (const f of results ?? []) {
      counts[f.status] = (counts[f.status] ?? 0) + 1;
    }
    return counts;
  }, [results]);

  const seasonCounts = useMemo(() => {
    const counts: Record<string, number> = { All: results?.length ?? 0 };
    for (const f of results ?? []) {
      counts[f.season] = (counts[f.season] ?? 0) + 1;
    }
    return counts;
  }, [results]);

  const airlineOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of results ?? []) {
      map.set(f.airline, (map.get(f.airline) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const filteredResults = useMemo(() => {
    if (!results) return null;
    const filtered = results.filter((flight) => {
      if (statusFilter !== "All" && flight.status !== statusFilter) return false;
      if (seasonFilter !== "All" && flight.season !== seasonFilter) return false;
      if (airlineFilter !== "All" && flight.airline !== airlineFilter)
        return false;
      if (!matchesTimeWindow(flight, timeWindow)) return false;
      return true;
    });

    if (sortMode === "fare") {
      return [...filtered].sort(
        (a, b) => a.estimatedFareUsd - b.estimatedFareUsd
      );
    }
    if (sortMode === "departure") {
      return [...filtered].sort(
        (a, b) =>
          getDepartureHour(a.departure.isoTime) -
          getDepartureHour(b.departure.isoTime)
      );
    }
    if (sortMode === "duration") {
      return [...filtered].sort(
        (a, b) => a.durationMinutes - b.durationMinutes
      );
    }
    return filtered;
  }, [results, statusFilter, seasonFilter, airlineFilter, timeWindow, sortMode]);

  const hasActiveFilters =
    statusFilter !== "All" ||
    seasonFilter !== "All" ||
    airlineFilter !== "All" ||
    timeWindow !== "all";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      {/* Flagship Multi-Input Booking Console */}
      <section
        ref={searchContainerRef}
        className="relative rounded-3xl border border-white/60 bg-white p-5 shadow-2xl shadow-slate-950/15 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              Country → Airport &amp; Flight # Search
            </span>
            <span className="text-xs text-slate-500">
              Select country then airport (e.g. Australia → Sydney, Melbourne,
              Brisbane, Perth, Adelaide)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(fromCountry !== "All" ||
              fromAirport !== "All" ||
              toCountry !== "All" ||
              toAirport !== "All" ||
              flightNumber ||
              results !== null) && (
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                Reset all
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                void runSearch({ browseAll: true, initialSort: "fare" })
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Browse all {MOCK_FLIGHTS.length} flights
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {/* Row 1: Departure (Country + Airport) <-> Arrival (Country + Airport) */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            {/* Departure Country + Airport */}
            <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="from-country-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  <PlaneTakeoff className="h-3.5 w-3.5 text-sky-600" />
                  From Country
                </label>
                <select
                  id="from-country-select"
                  value={fromCountry}
                  onChange={(e) => handleFromCountryChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15"
                >
                  <option value="All">All Countries</option>
                  {AVAILABLE_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="from-airport-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  <MapPin className="h-3.5 w-3.5 text-sky-600" />
                  From Airport
                </label>
                <select
                  id="from-airport-select"
                  value={fromAirport}
                  onChange={(e) => setFromAirport(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15"
                >
                  <option value="All">
                    {fromCountry === "All"
                      ? "All Departure Airports"
                      : `All ${fromCountry} Airports (${availableFromAirports.length})`}
                  </option>
                  {availableFromAirports.map((ap) => (
                    <option key={ap.code} value={ap.code}>
                      {ap.code} — {ap.location}
                      {fromCountry === "All" ? ` (${ap.country})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap Countries & Airports */}
            <div className="flex justify-center lg:pb-3">
              <button
                type="button"
                onClick={handleSwapCountries}
                title="Swap departure and arrival"
                aria-label="Swap departure and arrival"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>

            {/* Arrival Country + Airport */}
            <div className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="to-country-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  <PlaneLanding className="h-3.5 w-3.5 text-emerald-600" />
                  To Country
                </label>
                <select
                  id="to-country-select"
                  value={toCountry}
                  onChange={(e) => handleToCountryChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
                >
                  <option value="All">Anywhere (All Countries)</option>
                  {AVAILABLE_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="to-airport-select"
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600"
                >
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  To Airport
                </label>
                <select
                  id="to-airport-select"
                  value={toAirport}
                  onChange={(e) => setToAirport(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
                >
                  <option value="All">
                    {toCountry === "All"
                      ? "Any Destination Airport"
                      : `All ${toCountry} Airports (${availableToAirports.length})`}
                  </option>
                  {availableToAirports.map((ap) => (
                    <option key={ap.code} value={ap.code}>
                      {ap.code} — {ap.location}
                      {toCountry === "All" ? ` (${ap.country})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Flight Number Input + Search CTA */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="relative">
              <label
                htmlFor="flight-number-input"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                <Search className="h-3.5 w-3.5 text-indigo-600" />
                Flight Number (optional when selecting country/airport)
              </label>
              <div className="relative">
                <input
                  id="flight-number-input"
                  name="flightNumber"
                  type="text"
                  value={flightNumber}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setFlightNumber(e.target.value);
                    setShowSuggestions(true);
                    setActiveSuggestionIdx(-1);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Enter flight number (e.g. CZ326, OD172, BS213, UA123)"
                  autoComplete="off"
                  spellCheck={false}
                  aria-expanded={showSuggestions}
                  aria-autocomplete="list"
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50/80 pl-4 pr-10 text-sm font-semibold tracking-wide text-slate-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15"
                />
                {flightNumber && (
                  <button
                    type="button"
                    onClick={() => setFlightNumber("")}
                    aria-label="Clear flight number"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {showSuggestions && liveSuggestions.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Matching flight suggestions"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Instant Flight Matches</span>
                    <span>Enter</span>
                  </div>
                  <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                    {liveSuggestions.map((flight, index) => {
                      const isActive = index === activeSuggestionIdx;
                      const accent =
                        AIRLINE_ACCENTS[flight.airlineCode] ??
                        "from-slate-700 to-slate-900";
                      return (
                        <li key={flight.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setFlightNumber(flight.flightNumber);
                              setFromCountry("All");
                              setFromAirport("All");
                              setToCountry("All");
                              setToAirport("All");
                              void runSearch({
                                from: "All",
                                fromAirport: "All",
                                to: "All",
                                toAirport: "All",
                                query: flight.flightNumber,
                              });
                            }}
                            className={`flex w-full items-center justify-between gap-2.5 px-3.5 py-2.5 text-left transition ${
                              isActive ? "bg-sky-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accent} text-xs font-bold text-white`}
                              >
                                {flight.airlineCode}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {flight.flightNumber} · {flight.airline}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {flight.departure.location} (
                                  {flight.departure.airportCode}) →{" "}
                                  {flight.arrival.location} (
                                  {flight.arrival.airportCode})
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700">
                              ${flight.estimatedFareUsd}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-8 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plane className="h-4 w-4" />
              {isLoading ? "Searching..." : "Search Flights"}
            </button>
          </div>
        </form>

        {/* Popular Country/Airport Corridors & Sample Flight Numbers */}
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
              <Tag className="h-3.5 w-3.5 text-orange-500" />
              Deal Explorers &amp; Routes:
            </span>
            {POPULAR_CORRIDORS.map((corridor) => {
              const isSelected =
                fromCountry === corridor.from &&
                fromAirport === (corridor.fromAirport ?? "All") &&
                toCountry === corridor.to &&
                toAirport === (corridor.toAirport ?? "All") &&
                (!corridor.season || seasonFilter === corridor.season);
              return (
                <button
                  key={`${corridor.label}-${corridor.tag ?? ""}`}
                  type="button"
                  onClick={() => handleSelectCorridor(corridor)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    isSelected
                      ? "border-sky-500 bg-sky-50 text-sky-900"
                      : corridor.tag
                      ? "border-amber-200 bg-amber-50/70 text-amber-950 hover:border-amber-400 hover:bg-amber-100/80"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50/70 hover:text-sky-900"
                  }`}
                >
                  <span>{corridor.label}</span>
                  {corridor.tag && (
                    <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-extrabold text-orange-700 ring-1 ring-orange-200">
                      {corridor.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">
                Sample Flight #:
              </span>
              {SAMPLE_FLIGHT_NUMBERS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleQuickFlight(code)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
                >
                  {code}
                </button>
              ))}
            </div>

            {recentSearches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                  <History className="h-3.5 w-3.5" />
                  Recent:
                </span>
                {recentSearches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleQuickFlight(item)}
                    className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Search Results Directly Under the Form Input */}
      <section aria-live="polite" className="mt-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="h-8 w-44 rounded-xl bg-slate-200" />
                  <div className="h-6 w-24 rounded-full bg-slate-200" />
                </div>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div className="h-28 rounded-2xl bg-slate-100" />
                  <div className="h-12 self-center rounded-full bg-slate-100" />
                  <div className="h-28 rounded-2xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && results !== null && filteredResults !== null && (
          <>
            {results.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-600">
                    Showing{" "}
                    <span className="font-bold text-slate-900">
                      {filteredResults.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-800">
                      {results.length}
                    </span>{" "}
                    {results.length === 1 ? "flight" : "flights"} for{" "}
                    <span className="rounded-lg bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                      {searchLabel}
                    </span>
                  </p>

                  {/* Sort Tabs */}
                  <div
                    role="tablist"
                    aria-label="Sort flights"
                    className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold"
                  >
                    {(
                      [
                        { id: "best", label: "Best Match" },
                        { id: "fare", label: "Lowest Fare" },
                        { id: "departure", label: "Earliest" },
                        { id: "duration", label: "Fastest" },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={sortMode === tab.id}
                        onClick={() => setSortMode(tab.id)}
                        className={`rounded-lg px-3 py-1.5 transition ${
                          sortMode === tab.id
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Season Filter Strip */}
                {results.length > 1 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      Best Season:
                    </span>
                    {SEASON_OPTIONS.filter(
                      (opt) =>
                        opt.id === "All" || (seasonCounts[opt.id] ?? 0) > 0
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSeasonFilter(opt.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          seasonFilter === opt.id
                            ? "bg-amber-500 text-white"
                            : "bg-amber-50/80 text-amber-900 hover:bg-amber-100"
                        }`}
                      >
                        {opt.label} ({seasonCounts[opt.id] ?? 0})
                      </button>
                    ))}
                  </div>
                )}

                {results.length > 1 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Filter:
                    </span>

                    {(
                      [
                        "All",
                        "On Time",
                        "In Air",
                        "Boarding",
                        "Delayed",
                        "Scheduled",
                      ] as const
                    )
                      .filter(
                        (st) => st === "All" || (statusCounts[st] ?? 0) > 0
                      )
                      .map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatusFilter(st)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                            statusFilter === st
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {st} ({statusCounts[st] ?? 0})
                        </button>
                      ))}

                    <span className="mx-1 h-4 w-px bg-slate-200" />

                    {(
                      [
                        { id: "all", label: "Any time" },
                        { id: "morning", label: "Morning" },
                        { id: "afternoon", label: "Afternoon" },
                        { id: "evening", label: "Evening/Night" },
                      ] as const
                    ).map((win) => (
                      <button
                        key={win.id}
                        type="button"
                        onClick={() => setTimeWindow(win.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          timeWindow === win.id
                            ? "bg-sky-600 text-white"
                            : "bg-sky-50/70 text-sky-800 hover:bg-sky-100"
                        }`}
                      >
                        {win.label}
                      </button>
                    ))}

                    {airlineOptions.length > 1 && (
                      <select
                        aria-label="Filter by airline"
                        value={airlineFilter}
                        onChange={(e) => setAirlineFilter(e.target.value)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="All">All Airlines</option>
                        {airlineOptions.map(([name, count]) => (
                          <option key={name} value={name}>
                            {name} ({count})
                          </option>
                        ))}
                      </select>
                    )}

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => resetFilters()}
                        className="ml-auto text-xs font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-900"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {filteredResults.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <Plane className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-3 text-base font-bold text-slate-800">
                  {results.length === 0
                    ? `No matching flights found for ${searchLabel}`
                    : "No flights match the active filters"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {results.length === 0 ? (
                    <>
                      Try{" "}
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectCorridor({
                            from: "Australia",
                            fromAirport: "SYD",
                            to: "Bangladesh",
                            toAirport: "DAC",
                            label: "Sydney (SYD) → Bangladesh (DAC)",
                            sortBy: "fare",
                          })
                        }
                        className="font-semibold text-sky-700 underline underline-offset-2"
                      >
                        Sydney (SYD) → Bangladesh (DAC)
                      </button>{" "}
                      or{" "}
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectCorridor({
                            from: "Bangladesh",
                            fromAirport: "DAC",
                            to: "All",
                            toAirport: "All",
                            label: "Bangladesh → Anywhere",
                            sortBy: "fare",
                          })
                        }
                        className="font-semibold text-sky-700 underline underline-offset-2"
                      >
                        Bangladesh → Anywhere
                      </button>
                      .
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => resetFilters()}
                      className="font-semibold text-sky-700 underline underline-offset-2"
                    >
                      Reset filters to view all {results.length} matching flights
                    </button>
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResults.map((flight) => (
                  <FlightCard key={flight.id} flight={flight} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function FlightCard({ flight }: { flight: Flight }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const accent =
    AIRLINE_ACCENTS[flight.airlineCode] ?? "from-slate-700 to-slate-900";
  const statusStyle = STATUS_STYLES[flight.status];
  const tzDelta = formatTimeZoneDelta(flight);

  async function handleCopySummary() {
    const summary = `${flight.flightNumber} (${flight.airline}) | ${flight.departure.country} ${flight.departure.airportCode} (${flight.departure.location}) ${flight.departure.time} ${flight.departure.timeZone} -> ${flight.arrival.country} ${flight.arrival.airportCode} (${flight.arrival.location}) ${flight.arrival.time} ${flight.arrival.timeZone} | ${flight.stops}${flight.layover ? ` ${flight.layover}` : ""} | Duration: ${flight.duration} | Est. $${flight.estimatedFareUsd}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition hover:border-sky-300 hover:shadow-xl hover:shadow-slate-900/5">
      {/* Top Boarding-Pass Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-xs font-extrabold tracking-wider text-white shadow-sm`}
          >
            {flight.airlineCode}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold tracking-wide text-slate-900">
                {flight.flightNumber}
              </span>
              <span className="text-xs font-bold text-slate-600">
                {flight.airline}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {flight.departure.country} → {flight.arrival.country}
              </span>
              {flight.dealBadge && (
                <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-extrabold text-orange-700 ring-1 ring-orange-200">
                  {flight.dealBadge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {flight.aircraft} · {flight.cabin} · Best season:{" "}
              <span className="font-semibold text-slate-700">
                {flight.season}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 sm:inline-flex">
            {tzDelta}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${statusStyle.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
            {flight.status}
          </span>
        </div>
      </div>

      {/* Main Route Grid + Booking-Style Fare Column */}
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto_1fr_175px] lg:items-center">
        {/* Start Location, Start Time, Departure Time Zone */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700">
              <PlaneTakeoff className="h-3.5 w-3.5" />
              Start · Departure
            </span>
            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
              {flight.departure.country}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-black tracking-tight text-slate-900">
                {flight.departure.airportCode}
              </span>
              <span className="text-sm font-bold text-slate-800">
                {flight.departure.location}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{flight.departure.airportName}</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200/80">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="inline-flex items-center gap-1.5 text-xl font-extrabold text-slate-900">
                <Clock className="h-4 w-4 text-sky-600" />
                {flight.departure.time}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {flight.departure.date}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Globe className="h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span>
                {flight.departure.timeZone} · {flight.departure.ianaTimeZone}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {flight.departure.terminal} · Gate {flight.departure.gate}
            </p>
          </div>
        </div>

        {/* Center Route Connector */}
        <div className="flex flex-col items-center justify-center px-2 py-1 text-center">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
            {flight.duration}
          </span>
          <div className="my-2.5 flex w-full min-w-[125px] items-center gap-1.5 sm:w-32">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-600 bg-white" />
            <span className="h-px flex-1 border-t-2 border-dashed border-slate-300" />
            <span className="rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 p-1.5 text-white shadow-sm">
              <Plane className="h-3.5 w-3.5" />
            </span>
            <span className="h-px flex-1 border-t-2 border-dashed border-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-bold text-slate-600">
              {flight.stops}
            </span>
            {flight.layover && (
              <span className="text-[10px] font-medium text-slate-500">
                {flight.layover}
              </span>
            )}
            {flight.dayOffset > 0 && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                +{flight.dayOffset} {flight.dayOffset === 1 ? "day" : "days"}
              </span>
            )}
          </div>
        </div>

        {/* End Location, End Time, Arrival Time Zone */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <PlaneLanding className="h-3.5 w-3.5" />
              End · Arrival
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              {flight.arrival.country}
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-black tracking-tight text-slate-900">
                {flight.arrival.airportCode}
              </span>
              <span className="text-sm font-bold text-slate-800">
                {flight.arrival.location}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{flight.arrival.airportName}</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200/80">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="inline-flex items-center gap-1.5 text-xl font-extrabold text-slate-900">
                <Clock className="h-4 w-4 text-emerald-600" />
                {flight.arrival.time}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {flight.arrival.date}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                {flight.arrival.timeZone} · {flight.arrival.ianaTimeZone}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {flight.arrival.terminal} · Gate {flight.arrival.gate}
            </p>
          </div>
        </div>

        {/* Right Booking-Style Summary Column */}
        <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="lg:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Est. One-Way
            </p>
            <p className="text-2xl font-black tracking-tight text-slate-900">
              ${flight.estimatedFareUsd}
            </p>
            <p className="text-[11px] font-medium text-emerald-700">
              {flight.season.split(" ")[0]} Window
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:w-full lg:flex-col">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
            >
              {expanded ? (
                <>
                  Hide Details
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  View Details
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Info
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-slate-100 bg-slate-50 px-5 py-4 text-xs text-slate-600 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-bold text-slate-800">Departure ISO Timestamp</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-600">
              {flight.departure.isoTime}
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-800">Arrival ISO Timestamp</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-600">
              {flight.arrival.isoTime}
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-800">Corridor, Stops &amp; Shift</p>
            <p className="mt-0.5 text-slate-700">
              {flight.departure.country} → {flight.arrival.country} ({flight.stops}
              {flight.layover ? ` ${flight.layover}` : ""}, {tzDelta})
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
