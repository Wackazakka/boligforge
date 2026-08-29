import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import RefCapture from "./components/RefCapture";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "ReelHome — AI-drevet videoproduksjon for eiendomsmeglere",
  description:
    "ReelHome produserer profesjonelle visningsvideoer for eiendomsmeglere automatisk — med AI-avatar, din egen stemmeklone og kuratert musikk.",
  metadataBase: new URL("https://reelhome.ai"),
  alternates: { canonical: "/" },
  icons: {
    icon: "/brand-kit/favicon.svg",
    apple: "/brand-kit/reelhome-app-icon.svg",
  },
  // Delingsbildet MÅ være PNG/JPG: Facebook, LinkedIn og Slack rendrer ikke
  // SVG, så app-ikonet som lå her ga ingen forhåndsvisning i det hele tatt.
  // Lenken limes inn i e-poster og meldinger til meglere — da er dette bildet
  // det første de ser av produktet.
  openGraph: {
    type: "website",
    locale: "nb_NO",
    url: "https://reelhome.ai",
    siteName: "ReelHome",
    title: "ReelHome — AI-drevet videoproduksjon for eiendomsmeglere",
    description:
      "Profesjonelle visningsvideoer produsert automatisk — med AI-avatar, din egen stemmeklone og kuratert musikk.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ReelHome — visningsvideoer for eiendomsmeglere" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReelHome — AI-drevet videoproduksjon for eiendomsmeglere",
    description:
      "Profesjonelle visningsvideoer produsert automatisk — med AI-avatar, din egen stemmeklone og kuratert musikk.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RefCapture />
        {children}
      </body>
    </html>
  );
}
