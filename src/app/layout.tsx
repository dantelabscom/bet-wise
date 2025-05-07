import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster as HotToaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";
import AuthSessionProvider from "@/providers/auth-provider";
import { ToastProvider } from "@/providers/toast-provider";

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
          <HotToaster position="top-center" />
          <ToastProvider />
          <main className="min-h-screen">{children}</main>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
