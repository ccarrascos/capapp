import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B4A85",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            background: "#F2B705",
            clipPath: "polygon(50% 6%, 95% 92%, 5% 92%)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
