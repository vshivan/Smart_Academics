import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import TeacherBot from "@/components/TeacherBot";

export const metadata: Metadata = {
  title: "SAAP — Smart Academic Automation Platform",
  description: "Automate question papers, assignment evaluation, and analytics",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SAAP" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Providers>
          {children}
          <TeacherBot />
        </Providers>
      </body>
    </html>
  );
}
