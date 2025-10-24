import type React from "react"
import type { Metadata } from "next"
import { Domine, Manrope } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Navbar from "@/components/navbar"
import "./globals.css"

const domine = Domine({
  subsets: ["latin"],
  variable: "--font-domine",
  display: "swap",
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})

export const metadata: Metadata = {
  title: "TypeCut - Animated Font Switching Tool",
  description:
    "Create stunning animated font switching effects for social media. Export as WebM, GIF, or After Effects scripts.",
  generator: "TypeCut",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${domine.variable} font-sans antialiased`}>
        <div className="h-screen flex flex-col overflow-hidden">
          <Navbar />
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
        <Analytics />
      </body>
    </html>
  )
}
