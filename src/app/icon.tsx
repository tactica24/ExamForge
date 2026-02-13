import type { MetadataRoute } from "next";

export default function Icon(): MetadataRoute.IconDescriptor {
  return {
    url: "/icon.svg",
    type: "image/svg+xml"
  };
}

