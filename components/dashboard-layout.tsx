"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/contexts/auth-context"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Menu, Home, Package, Users, Settings, LogOut, BarChart3, UserCheck, Mail, User } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const getNavigationItems = () => {
    if (!profile) return []

    const baseItems = [
      {
        name: "Dashboard",
        href:
          profile.role === "super_admin"
            ? "/super-admin"
            : profile.role === "admin"
              ? "/admin/dashboard"
              : "/driver/home",
        icon: Home,
      },
    ]

    if (profile.role === "super_admin") {
      return [
        ...baseItems,
        { name: "Admins", href: "/super-admin/admins", icon: UserCheck },
        { name: "All Drivers", href: "/super-admin/drivers", icon: Users },
        { name: "System Stats", href: "/super-admin/stats", icon: BarChart3 },
      ]
    }

    if (profile.role === "admin") {
      return [
        ...baseItems,
        { name: "Orders", href: "/admin/orders", icon: Package },
        { name: "Drivers", href: "/admin/drivers", icon: Users },
      ]
    }

    if (profile.role === "driver") {
      return [
        ...baseItems,
        { name: "Orders", href: "/driver/orders", icon: Package },
        { name: "Invitations", href: "/driver/invitations", icon: Mail },
        { name: "Profile", href: "/driver/profile", icon: User },
      ]
    }

    return baseItems
  }

  const navigationItems = getNavigationItems()

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex h-full flex-col ${mobile ? "w-full" : "w-64"}`}>
      <div className="flex h-14 items-center border-b px-4">
        <Link
          className="flex items-center gap-2 font-semibold"
          href={
            profile.role === "super_admin"
              ? "/super-admin"
              : profile.role === "admin"
                ? "/admin/dashboard"
                : "/driver/orders"
          }
        >
          <Package className="h-6 w-6" />
          <span>Delivery System</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent ${
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              }`}
              onClick={() => mobile && setSidebarOpen(false)}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )

  if (!profile) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden border-r bg-muted/40 lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
          </Sheet>

          <div className="flex-1" />

          <ThemeToggle />

          <NotificationsDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {profile.first_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {profile.first_name} {profile.last_name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {profile.role.replace("_", " ")}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(profile.role === "driver" ? "/driver/profile" : "/profile")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
