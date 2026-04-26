import "../app/globals.css";
import type { Preview } from '@storybook/nextjs-vite';
import { Geist, Geist_Mono, Michroma, Share_Tech_Mono } from "next/font/google";
import { createElement } from "react";

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

const preview: Preview = {
  decorators: [
    (Story) => createElement(
      "div",
      { className: `${geistSans.variable} ${geistMono.variable} ${michroma.variable} ${shareTechMono.variable} antialiased` },
      createElement(Story)
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;