import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "PNG Alert", short_name: "PNG Alert", description: "Know what's happening before you get there.", start_url: "/", display: "standalone", background_color: "#eef2f4", theme_color: "#ce1126" };
}
