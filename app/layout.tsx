import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local AI Chat",
  description: "Real-time chat with voice, powered by Ollama and LM Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
