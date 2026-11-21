import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
  preload: true,
});
export const metadata: Metadata = {
  title: {
    default: "Cooper · Tu estudio de creación",
    template: "%s · Cooper",
  },
  description:
    "De una idea a tu próximo video. Tu espacio de creación con Cooper.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="oscuro" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
