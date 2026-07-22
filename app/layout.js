import "./globals.css";
import Sidebar from "./Sidebar";

export const metadata = {
  title: "POSG Tour",
  description: "POSG Tour Manager — order of merit, handicaps, events, players",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-posgbg text-posgtext flex">
        <Sidebar />
        <main className="flex-1 min-w-0 px-8 py-8 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
