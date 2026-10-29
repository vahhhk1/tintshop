import { ImageResponse } from "next/og";
import { IconArt } from "@/components/pwa/icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconArt size={180} padding={0.2} rounded={false} />, size);
}
