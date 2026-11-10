import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pogo — Get it handled",
  description: "Your personal agent that gets things done. Message Pogo, then get on with your day.",
  metadataBase: new URL("https://heypogo.xyz"),
  icons: {
    icon: [{ url: "/pogo-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/pogo-icon.svg", type: "image/svg+xml" }]
  },
  openGraph: {
    title: "Pogo — Get it handled",
    description: "Tell Pogo what needs doing. It takes it from there.",
    url: "https://heypogo.xyz",
    siteName: "Pogo",
    type: "website",
    images: [{ url: "/pogo-icon.svg", width: 512, height: 512, alt: "Pogo" }]
  },
  twitter: {
    card: "summary",
    title: "Pogo — Get it handled",
    description: "Your personal agent that gets things done.",
    images: ["/pogo-icon.svg"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
