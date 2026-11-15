import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if(process.env.SOFT_LAUNCH_PRIVATE === "true") return { rules: [{ userAgent: "*", disallow: "/" }] };
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
