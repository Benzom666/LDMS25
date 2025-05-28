"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarNavProps {
  items: {
    title: string
    href: string
    icon: string | LucideIcon
  }[]
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="grid items-start gap-2 px-2">
      {items.map((item) => {
        const Icon = typeof item.icon === "string" ? null : item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-accent text-accent-foreground" : "transparent",
            )}
          >
            {Icon && <Icon className="mr-2 h-4 w-4" />}
            <span>{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
