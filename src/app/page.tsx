import { Plane, Compass, Globe2 } from "lucide-react";
import FlightLookup from "@/components/FlightLookup";
import { AVAILABLE_COUNTRIES, MOCK_FLIGHTS } from "@/lib/mock-flights";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#eef2f8]">
      {/* Luxury Travel Booking Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#061121] via-[#0c2442] to-[#0e3f66] pb-28 pt-6 text-white sm:pb-32 sm:pt-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-amber-400/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl"
        />

        {/* Top Nav Bar */}
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-md">
              <Plane className="h-5 w-5" />
            </span>
            <div>
              <span className="text-lg font-black tracking-tight text-white">
                SkyVoyage
              </span>
              <span className="ml-2 hidden rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 sm:inline">
                Flight Finder
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-200">
            <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 sm:inline-flex">
              <Globe2 className="h-3.5 w-3.5 text-sky-300" />
              {AVAILABLE_COUNTRIES.length} Countries
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
              <Compass className="h-3.5 w-3.5 text-amber-300" />
              {MOCK_FLIGHTS.length} Live Mock Flights
            </span>
          </div>
        </nav>

        <header className="relative mx-auto mt-8 max-w-6xl px-4 sm:mt-10 sm:px-6">
          <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            Country-to-country flights &amp; instant schedule lookup.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Pick your departure and arrival countries or enter a flight number
            to view exact start and end times, local time zones, and airport
            locations.
          </p>
        </header>
      </div>

      {/* Overlapping Booking Search Console + Results */}
      <div className="-mt-20 sm:-mt-24">
        <FlightLookup />
      </div>
    </main>
  );
}
