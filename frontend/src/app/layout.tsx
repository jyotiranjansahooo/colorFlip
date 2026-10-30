import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import InitialLoadingScreen from "@/components/InitialLoadingScreen";

export const metadata: Metadata = {
  title: "ColorFlip — Multiplayer Card Game",
  description:
    "Play ColorFlip with friends or challenge the computer in this exciting multiplayer card game.",
  applicationName: "ColorFlip",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {" "}
        <InitialLoadingScreen />
        {children}
      </body>
    </html>
  );
}
