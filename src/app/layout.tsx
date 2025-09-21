// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ContentGen AI",
  description: "Generate social media content from your meetings.",
};

// This is the ROOT layout. It MUST have <html> and <body> tags.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}