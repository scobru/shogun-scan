import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { GunProvider } from "@/lib/gun-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Task App",
  description: "A simple task management app using GunDB",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GunProvider>{children}</GunProvider>
      </body>
    </html>
  )
}



import './globals.css'