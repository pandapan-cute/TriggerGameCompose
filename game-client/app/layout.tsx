import type { Metadata } from "next";
import { Geist, Geist_Mono, Michroma, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import WebSocketProvider from "@/contexts/WebSocketContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const michroma = Michroma({
  variable: "--font-michroma",
  subsets: ["latin"],
  weight: "400",
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Grid Field",
  description: "A strategic hexagonal grid simulation game inspired by World Trigger.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${michroma.variable} ${shareTechMono.variable} antialiased`}
      >
        <WebSocketProvider>{children}</WebSocketProvider>
      </body>
    </html>
  );
}
