import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/componentes/estado-espacio.css";
const clash = localFont({
  src: "../../public/fonts/ClashDisplay-Variable.woff2",
  variable: "--font-clash",
  weight: "500 600",
  display: "swap",
  preload: true,
});
const geist = localFont({
  src: "../../public/fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "400 600",
  display: "swap",
  preload: true,
});
const geistMono = localFont({
  src: "../../public/fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "400 600",
  display: "swap",
  preload: false,
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
    <html
      lang="es"
      data-theme="oscuro"
      className={`${clash.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
