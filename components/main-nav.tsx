import Link from "next/link"
import { Package } from "lucide-react"

interface MainNavProps {
  className?: string
}

export function MainNav({ className }: MainNavProps) {
  return (
    <div className={`flex items-center space-x-4 lg:space-x-6 ${className}`}>
      <Link href="/" className="flex items-center space-x-2">
        <Package className="h-6 w-6" />
        <span className="font-bold">Delivery System</span>
      </Link>
    </div>
  )
}
