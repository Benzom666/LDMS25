"use client"

import type React from "react"
import BottomNavigation from "./bottom-navigation"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-4">{children}</main>
      <BottomNavigation />
    </div>
  )
}
