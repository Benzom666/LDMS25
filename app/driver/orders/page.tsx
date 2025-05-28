"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { Scan, Package, CheckCircle, AlertTriangle, Search, Filter, ArrowUpDown } from "lucide-react"

export default function DriverOrdersPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (profile?.user_id) {
      fetchOrders()
    }
  }, [profile, activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("driver_id", profile.user_id)
        .order("created_at", { ascending: false })

      if (activeTab === "active") {
        query = query.in("status", ["assigned", "picked_up", "in_transit"])
      } else if (activeTab === "completed") {
        query = query.eq("status", "delivered")
      } else if (activeTab === "failed") {
        query = query.in("status", ["failed", "returned", "cancelled"])
      }

      const { data, error } = await query
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.delivery_address.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query)
    )
  })

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any }> = {
      assigned: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: Package },
      picked_up: { color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Package },
      in_transit: { color: "bg-purple-100 text-purple-800 border-purple-200", icon: Package },
      delivered: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
      returned: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle },
      cancelled: { color: "bg-gray-100 text-gray-800 border-gray-200", icon: AlertTriangle },
    }

    const config = statusConfig[status] || statusConfig.assigned
    const Icon = config.icon

    return (
      <div
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.color}`}
      >
        <Icon className="mr-1 h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
      </div>
    )
  }

  const getPriorityBadge = (priority: string) => {
    if (!priority) return null

    const priorityConfig: Record<string, { color: string }> = {
      low: { color: "bg-gray-100 text-gray-800 border-gray-200" },
      medium: { color: "bg-blue-100 text-blue-800 border-blue-200" },
      high: { color: "bg-amber-100 text-amber-800 border-amber-200" },
      urgent: { color: "bg-red-100 text-red-800 border-red-200" },
    }

    const config = priorityConfig[priority.toLowerCase()] || priorityConfig.medium

    return (
      <div className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.color}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Orders</h1>
            <p className="text-muted-foreground">Manage and track your delivery orders</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/driver/scanner")} className="flex items-center gap-2">
              <Scan className="h-4 w-4" />
              Scan Barcode
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              className="pl-8 w-full sm:w-[300px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </Button>
          </div>
        </div>

        <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active (0)</TabsTrigger>
            <TabsTrigger value="completed">Completed (3)</TabsTrigger>
            <TabsTrigger value="failed">Failed (2)</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No active orders</h3>
                  <p className="text-muted-foreground text-center mt-2">
                    You don't have any active orders assigned to you at the moment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/driver/orders/${order.id}`)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{order.order_number}</span>
                            {getPriorityBadge(order.priority)}
                          </div>
                          <p className="text-sm">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 sm:mt-0">
                          {getStatusBadge(order.status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/driver/orders/${order.id}`)
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            {/* Similar content for completed orders */}
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/driver/orders/${order.id}`)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{order.order_number}</span>
                            {getPriorityBadge(order.priority)}
                          </div>
                          <p className="text-sm">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 sm:mt-0">
                          {getStatusBadge(order.status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/driver/orders/${order.id}`)
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="failed" className="mt-4">
            {/* Similar content for failed orders */}
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/driver/orders/${order.id}`)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{order.order_number}</span>
                            {getPriorityBadge(order.priority)}
                          </div>
                          <p className="text-sm">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 sm:mt-0">
                          {getStatusBadge(order.status)}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/driver/orders/${order.id}`)
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
