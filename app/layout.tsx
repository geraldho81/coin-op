import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Press_Start_2P } from "next/font/google";
import "./globals.css";

const press = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press",
  display: "swap",
});

const chakra = Chakra_Petch({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COIN-OP",
  description: "Insert coin. Arcade first-person shooter.",
};

export const viewport: Viewport = {
  themeColor: "#070806",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${press.variable} ${chakra.variable}`}>{children}</body>
    </html>
  );
}
