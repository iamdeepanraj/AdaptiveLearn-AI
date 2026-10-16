import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AdaptiveLearn AI — Personalized Tutoring with Adaptive Learning",
  description: "Source-grounded RAG study companion, Bayesian Knowledge Tracing learner model, multimodal textbook ingestion, and adaptive assessments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${inter.className} min-h-full flex flex-col bg-bg text-fg`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Suspense fallback={<div className="h-16 border-b border-line bg-surface" />}>
              <Navbar />
            </Suspense>
            <main className="flex-1 flex flex-col">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center p-12 text-fg-3">Loading...</div>}>
                {children}
              </Suspense>
            </main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
