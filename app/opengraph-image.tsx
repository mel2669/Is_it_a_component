import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Is it component? — A focused tool for design system intake triage.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Google Fonts CSS → WOFF or TTF URL.
 * Satori (next/og) does not accept woff2 (“Unsupported OpenType signature wOF2”).
 */
async function fetchInter(weight: 400 | 600): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)"
      }
    }
  ).then((r) => r.text());
  const woff =
    css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]woff['"]\)/i)?.[1] ??
    css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]truetype['"]\)/i)?.[1];
  if (!woff) {
    throw new Error(`Failed to resolve Inter ${weight} font from Google Fonts CSS`);
  }
  return fetch(woff).then((r) => r.arrayBuffer());
}

export default async function OpenGraphImage() {
  const [inter400, inter600] = await Promise.all([fetchInter(400), fetchInter(600)]);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#07080a",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "-10%",
            top: -24,
            width: "130%",
            height: 48,
            opacity: 0.82,
            transform: "rotate(-6deg)",
            background: "linear-gradient(90deg, #ff5757, #a1131a)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-8%",
            top: 40,
            width: "130%",
            height: 44,
            opacity: 0.68,
            transform: "rotate(-6deg)",
            background: "linear-gradient(90deg, #ff5757, #a1131a)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-6%",
            top: 96,
            width: "130%",
            height: 40,
            opacity: 0.52,
            transform: "rotate(-6deg)",
            background: "linear-gradient(90deg, #ff5757, #a1131a)"
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            padding: 72,
            gap: 28
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 14,
                border: "1px solid #242728",
                background: "#121212",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 600,
                color: "#ff5757",
                fontFamily: "Inter"
              }}
            >
              ?
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}
            >
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 600,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                  color: "#f4f4f6",
                  fontFamily: "Inter"
                }}
              >
                Is it component?
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  lineHeight: 1.45,
                  color: "#cdcdcd",
                  maxWidth: 880,
                  fontFamily: "Inter"
                }}
              >
                A focused tool for the most common design system intake question.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 8
            }}
          >
            <div
              style={{
                padding: "14px 22px",
                borderRadius: 8,
                border: "1px solid #242728",
                background: "#0d0d0d",
                color: "#f4f4f6",
                fontSize: 18,
                fontWeight: 600,
                fontFamily: "Inter"
              }}
            >
              Variant or new component
            </div>
            <div
              style={{
                padding: "14px 22px",
                borderRadius: 8,
                border: "1px solid #242728",
                background: "#ffffff",
                color: "#000000",
                fontSize: 18,
                fontWeight: 600,
                fontFamily: "Inter"
              }}
            >
              Five questions → verdict + next step
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter400, weight: 400, style: "normal" },
        { name: "Inter", data: inter600, weight: 600, style: "normal" }
      ]
    }
  );
}
