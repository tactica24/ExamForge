import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ACE NAIJA",
    short_name: "ACE NAIJA",
    description: "AI-powered exam prep PWA for WAEC, JAMB, IELTS, ACCA, and ICAN.",
    start_url: "/",
    display: "standalone",
    background_color: "#08314a",
    theme_color: "#0d4a6a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
