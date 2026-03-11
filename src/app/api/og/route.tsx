import { ImageResponse } from "next/og";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND_PRIMARY = "#002147";
const BRAND_TEXT_MUTED = "#324664";

const THUMBNAIL_BY_KEY: Record<string, string> = {
  home: "/champaign parking map thumbnail.png",
  data: "/champaign parking map thumbnail.png",
  zoning: "/champaign parking map thumbnail.png",
  parking: "/champaign parking map thumbnail.png",
  writings: "/writings/century-old-building-layout.jpg",
  action: "/writings/ghosts-of-philo-road.jpg",
  about: "/logos/abundantcu-full.png",
};

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const title = clamp(
    searchParams.get("title")?.trim() || "Making Champaign-Urbana Affordable and Abundant.",
    74
  );
  const subtitle = clamp(
    searchParams.get("subtitle")?.trim() ||
      "We leverage data and policy to build a resilient city that works for everyone.",
    120
  );

  const imageKey = searchParams.get("image")?.trim() || "home";
  const isHome = imageKey === "home";
  const imagePath = THUMBNAIL_BY_KEY[imageKey] || THUMBNAIL_BY_KEY.home;

  const logoSrc = `${origin}/logos/abundantcu-logo.png`;
  const heroSrc = `${origin}${imagePath}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          background: "#f3f4f6",
          color: BRAND_PRIMARY,
          fontFamily: "Arial, sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "58%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "42px 48px 46px",
            background: "linear-gradient(180deg, #f4f5f7 0%, #eceff3 100%)",
          }}
        >
          {isHome ? (
            <div />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img
                src={logoSrc}
                alt="Abundant CU logo"
                width={56}
                height={49}
                style={{ objectFit: "contain" }}
              />
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    fontSize: 50,
                    lineHeight: 1,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                    color: BRAND_PRIMARY,
                  }}
                >
                  ABUNDANT
                </span>
                <span
                  style={{
                    fontSize: 50,
                    lineHeight: 1,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: BRAND_PRIMARY,
                  }}
                >
                  CU
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {isHome ? (
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <img
                  src={logoSrc}
                  alt="Abundant CU logo"
                  width={90}
                  height={79}
                  style={{ objectFit: "contain" }}
                />
                <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                  <span
                    style={{
                      fontSize: 74,
                      lineHeight: 1,
                      fontWeight: 800,
                      letterSpacing: "0.01em",
                      color: BRAND_PRIMARY,
                    }}
                  >
                    ABUNDANT
                  </span>
                  <span
                    style={{
                      fontSize: 74,
                      lineHeight: 1,
                      fontWeight: 600,
                      letterSpacing: "0.01em",
                      color: BRAND_PRIMARY,
                    }}
                  >
                    CU
                  </span>
                </div>
              </div>
            ) : null}
            <div
              style={{
                fontSize: isHome ? 66 : 74,
                lineHeight: 1.01,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: BRAND_PRIMARY,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 42,
                lineHeight: 1.24,
                color: BRAND_TEXT_MUTED,
                maxWidth: "94%",
              }}
            >
              {subtitle}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                background: BRAND_PRIMARY,
                color: "#ffffff",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              abundantcu.com
            </div>
          </div>
        </div>

        <div
          style={{
            width: "42%",
            height: "100%",
            borderLeft: "1px solid rgba(0, 33, 71, 0.12)",
            position: "relative",
            display: "flex",
          }}
        >
          <img
            src={heroSrc}
            alt="Page thumbnail"
            width={504}
            height={630}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,33,71,0.10) 0%, rgba(0,33,71,0.20) 100%)",
            }}
          />
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  );
}
