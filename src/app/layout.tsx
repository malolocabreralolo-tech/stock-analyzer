import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Analyzer - Financial Analysis Platform",
  description: "Analyze US stocks, estimate intrinsic value, and build optimal portfolios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <div className="flex min-h-screen">
            {/* Desktop sidebar */}
            <div className="hidden lg:block">
              <Sidebar />
            </div>
            <main className="flex-1 flex flex-col min-w-0">
              <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 lg:px-6 py-2.5 flex items-center gap-3">
                {/* Mobile hamburger */}
                <MobileNav />
                <SearchBar />
                <ThemeToggle />
              </header>
              <div className="flex-1 p-4 lg:p-6">
                {children}
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
