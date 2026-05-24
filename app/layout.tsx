import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

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
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    images: [{ url: "/logo.png" }],
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
        {children}
        <footer style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: 'var(--muted, #999)', borderTop: '1px solid var(--line, #eee)', marginTop: 'auto' }}>
          Powered by <a href="https://norditech.no" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}>Norditech AS</a>
        </footer>
      </body>
    </html>
  );
}
