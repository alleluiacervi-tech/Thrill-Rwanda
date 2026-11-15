import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Dashboards and auth screens carry no public value and should never
        // appear in an index.
        disallow: ["/account/", "/provider/", "/admin/", "/staff/", "/api/", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
