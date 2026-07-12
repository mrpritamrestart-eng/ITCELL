import type { Metadata } from "next";
import "./globals.css";
import ConditionalHeader from "@/components/ConditionalHeader";

export const metadata: Metadata = {
  title: "Office Billing Automation",
  description: "Stationery bills, stock, permissions and comparative quotation management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><ConditionalHeader />{children}</body>
    </html>
  );
}
