import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyPulse — Flight Lookup",
  description:
    "Look up flight schedules, departure and arrival times, time zones, and airport locations by flight number.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-sky-200 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}
