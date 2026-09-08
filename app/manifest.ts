import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VDC Training OS",
    short_name: "VDC Training",
    description: "Digitale Trainingsplattform des Vestischen Dart Club e.V.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#090b0f",
    theme_color: "#b91c1c",
    lang: "de-DE",
    categories: ["sports", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
