import "./globals.css";
import AppShell from "./AppShell";
import RegisterServiceWorker from "./RegisterServiceWorker";

export const metadata = {
  title: "POSG Tour",
  description:
    "POSG Tour Manager — order of merit, handicaps, events, players. The home of shit golf.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "POSG Tour",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070b10",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-posgbg text-posgtext">
        <RegisterServiceWorker />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
