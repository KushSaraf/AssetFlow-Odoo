import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "../providers/QueryProvider";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";

export const metadata: Metadata = {
  title: "AssetFlow — Asset Management System",
  description: "Odoo-style Asset Tracking and Flow Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F7F7F8] text-[#1F1F1F]">
        <QueryProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
