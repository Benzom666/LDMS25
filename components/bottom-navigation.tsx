"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MapPin, List, User, Settings } from "lucide-react"

interface NavItem {
  href: string
  icon: React.ComponentType
  label: string
}

const navItems: NavItem[] = [
  { href: "/driver", icon: Home, label: "Home" },
  { href: "/driver/map", icon: MapPin, label: "Map" },
  { href: "/driver/tasks", icon: List, label: "Tasks" },
  { href: "/driver/profile", icon: User, label: "Profile" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
]

export default function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <ul className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-md ${
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-blue-600"
                }`}
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
