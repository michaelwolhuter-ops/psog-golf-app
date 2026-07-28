import "./globals.css";
import AppShell from "./AppShell";

export const metadata = {
  title: "POSG Tour",
  description:
    "POSG Tour Manager — order of merit, handicaps, events, players. The home of shit golf.",
  icons: {
    icon: "/logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-posgbg text-posgtext">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
