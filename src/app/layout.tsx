import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "AurumTemple — JJJ Factory ERP",
  description: "Jewellery manufacturing ERP for the Chennai factory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
