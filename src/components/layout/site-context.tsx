"use client";

import * as React from "react";
import { buildSite, type SiteInfo } from "@/lib/site-config";

// The defaults until the layout provides the admin's values, so a component used outside it still works.
const SiteContext = React.createContext<SiteInfo>(buildSite(null));

/** Hands the admin's business details to client components. Set once in the root layout. */
export function SiteProvider({ value, children }: { value: SiteInfo; children: React.ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

/** The business name, contacts and rules, as the admin set them. */
export function useSite() {
  return React.useContext(SiteContext);
}
