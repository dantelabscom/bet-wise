import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";
import AuthSessionProvider from "@/providers/auth-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BetWise - A Smarter Way to Bet.",
  description: "A Smarter Way to Bet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthSessionProvider>
          <Toaster position="top-center" />
          <main className="min-h-screen">{children}</main>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
