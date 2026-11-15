import { ImageResponse } from "next/og";
import { getSite } from "@/lib/settings";
export const alt = "Thrill Rwanda — flights and Rwanda travel planning";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image() {
  const site = await getSite();
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#123d2e",
        color: "#faf6ec",
        padding: "85px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 34,
          letterSpacing: 5,
          color: "#eabb68",
        }}
      >
        {site.name}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 76,
          marginTop: 45,
          lineHeight: 1.1,
        }}
      >
        Your journey starts with a conversation.
      </div>
      <div style={{ display: "flex", fontSize: 29, marginTop: 40 }}>
        Flight quotes · Rwanda travel planning
      </div>
    </div>,
    size,
  );
}
