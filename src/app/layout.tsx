import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pogo — Your business, with someone in its corner",
  description: "The context-rich business agent for launches, creators, customers, and the work that keeps growing teams moving.",
  metadataBase: new URL("https://heypogo.xyz"),
  icons: {
    icon: [{ url: "/pogo-mascot.svg", type: "image/svg+xml" }],
    apple: [{ url: "/pogo-mascot.svg", type: "image/svg+xml" }]
  },
  openGraph: {
    title: "Pogo — Get it handled",
    description: "The agent that knows your product, your people, and what you are trying to make happen.",
    url: "https://heypogo.xyz",
    siteName: "Pogo",
    type: "website",
    images: [{ url: "/pogo-mascot.svg", width: 512, height: 512, alt: "Pogo mascot" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Pogo — Get it handled",
    description: "Your personal agent that gets things done.",
    images: ["/pogo-mascot.svg"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
