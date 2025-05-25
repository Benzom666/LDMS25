"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { OrderTemplateGenerator } from "@/components/order-template-generator"
import DeliveryMap from "@/components/delivery-map"
import {
  Package,
  Clock,
  CheckCircle,
  MapPin,
  Phone,
  Navigation,
  Search,
  AlertTriangle,
  Calendar,
  User,
  Truck,
  Edit,
  Plus,
  FileText,
  Upload,
  Download,
  Trash2,
  UserCheck,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface OrderWithActions extends Order {
  driver_name?: string
}

interface BulkUploadResult {
  imported: number
  total_processed: number
  validation_errors?: string[]
  insert_errors?: string[]
}

export default function AdminOrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithActions[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [driverFilter, setDriverFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("all")
  const [showMap, setShowMap] = useState(false)
  const [mapOrders, setMapOrders] = useState<OrderWithActions[]>([])
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([])

  // Bulk operations state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)

  useEffect(() => {
    if (profile) {
      fetchOrders()
      fetchDrivers()
    }
  }, [profile])

  const fetchDrivers = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, user_id")
        .eq("role", "driver")
        .eq("admin_id", profile.user_id)

      if (error) throw error

      const driverList = (data || []).map((driver) => ({
        id: driver.user_id,
        name: `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || "Unknown Driver",
      }))

      setDrivers(driverList)
    } catch (error) {
      console.error("Error fetching drivers:", error)
    }
  }

  const fetchOrders = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // First fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Then fetch driver information separately
      const { data: driversData, error: driversError } = await supabase
        .from("user_profiles")
        .select("user_id, first_name, last_name")
        .eq("role", "driver")

      if (driversError) throw driversError

      // Create a map of driver_id to driver info
      const driverMap = new Map()
      driversData?.forEach((driver) => {
        driverMap.set(driver.user_id, `${driver.first_name || ""} ${driver.last_name || ""}`.trim())
      })

      // Combine orders with driver names
      const ordersWithDriverNames = (ordersData || []).map((order: any) => ({
        ...order,
        driver_name: order.driver_id ? driverMap.get(order.driver_id) || "Unknown Driver" : "Unassigned",
      }))

      setOrders(ordersWithDriverNames)
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

  // Bulk file upload handler
  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    const formData = new FormData()
    formData.append("file", file)
    formData.append("adminId", profile.user_id)

    setUploadProgress(0)
    setUploadStatus("Uploading file...")
    setShowBulkUpload(true)
    setUploadResult(null)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch("/api/upload-orders", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      setUploadStatus("Upload completed successfully!")
      setUploadResult(result)

      toast({
        title: "Upload Successful",
        description: `${result.imported} orders imported successfully`,
      })

      // Refresh orders list
      await fetchOrders()
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus("Upload failed")
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload orders",
        variant: "destructive",
      })
    }

    // Reset file input
    event.target.value = ""
  }

  // Bulk actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentTabOrders = getOrdersByTab(activeTab)
      setSelectedOrders(new Set(currentTabOrders.map((order) => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders)
    if (checked) {
      newSelected.add(orderId)
    } else {
      newSelected.delete(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleBulkAssignDriver = async (driverId: string) => {
    if (selectedOrders.size === 0) return

    setBulkActionLoading(true)
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "assigned",
          assigned_at: new Date().toISOString(),
        })
        .in("id", Array.from(selectedOrders))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedOrders.size} orders assigned to driver`,
      })

      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error("Bulk assign error:", error)
      toast({
        title: "Error",
        description: "Failed to assign orders to driver",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkStatusChange = async (status: string) => {
    if (selectedOrders.size === 0) return

    setBulkActionLoading(true)
    try {
      const { error } = await supabase.from("orders").update({ status }).in("id", Array.from(selectedOrders))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedOrders.size} orders updated to ${status}`,
      })

      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error("Bulk status change error:", error)
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedOrders.size} orders? This action cannot be undone.`)) {
      return
    }

    setBulkActionLoading(true)
    try {
      const { error } = await supabase.from("orders").delete().in("id", Array.from(selectedOrders))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedOrders.size} orders deleted`,
      })

      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error("Bulk delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete orders",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const exportSelectedOrders = () => {
    const currentTabOrders = getOrdersByTab(activeTab)
    const ordersToExport =
      selectedOrders.size > 0 ? currentTabOrders.filter((order) => selectedOrders.has(order.id)) : currentTabOrders

    const csvHeaders = [
      "Order Number",
      "Customer Name",
      "Customer Phone",
      "Customer Email",
      "Pickup Address",
      "Delivery Address",
      "Status",
      "Priority",
      "Driver",
      "Created Date",
    ]

    const csvData = ordersToExport.map((order) => [
      order.order_number,
      order.customer_name,
      order.customer_phone || "",
      order.customer_email || "",
      order.pickup_address,
      order.delivery_address,
      order.status,
      order.priority,
      order.driver_name || "Unassigned",
      new Date(order.created_at).toLocaleDateString(),
    ])

    const csvContent = [csvHeaders, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `orders-export-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Complete",
      description: `${ordersToExport.length} orders exported to CSV`,
    })
  }

  const viewOrdersOnMap = async () => {
    const currentTabOrders = getOrdersByTab(activeTab)
    const ordersToShow =
      selectedOrders.size > 0 ? currentTabOrders.filter((order) => selectedOrders.has(order.id)) : currentTabOrders

    if (ordersToShow.length === 0) {
      toast({
        title: "No Orders",
        description: "No orders to display on map.",
        variant: "destructive",
      })
      return
    }

    setMapOrders(ordersToShow)
    setShowMap(true)

    toast({
      title: "Map Loaded",
      description: `Displaying ${ordersToShow.length} orders on map`,
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: Clock, label: "Pending" },
      assigned: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Assigned" },
      in_transit: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: Navigation, label: "In Transit" },
      delivered: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Delivered" },
      failed: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, label: "Failed" },
      cancelled: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: AlertTriangle, label: "Cancelled" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: Package,
      label: status.replace("_", " "),
    }

    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: { color: "bg-red-100 text-red-800 border-red-200", label: "Urgent" },
      high: { color: "bg-red-100 text-red-800 border-red-200", label: "High" },
      normal: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Normal" },
      low: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Low" },
    }

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal

    return (
      <Badge variant="outline" className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.driver_name && order.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter
    const matchesDriver = driverFilter === "all" || order.driver_id === driverFilter

    return matchesSearch && matchesStatus && matchesPriority && matchesDriver
  })

  const getOrdersByTab = (tab: string) => {
    switch (tab) {
      case "active":
        return filteredOrders.filter((order) => !["delivered", "failed", "cancelled"].includes(order.status))
      case "completed":
        return filteredOrders.filter((order) => order.status === "delivered")
      case "failed":
        return filteredOrders.filter((order) => order.status === "failed")
      default:
        return filteredOrders
    }
  }

  const getTabCount = (tab: string) => {
    return getOrdersByTab(tab).length
  }

  const currentTabOrders = getOrdersByTab(activeTab)
  const allSelected = currentTabOrders.length > 0 && currentTabOrders.every((order) => selectedOrders.has(order.id))
  const someSelected = currentTabOrders.some((order) => selectedOrders.has(order.id))

  if (!profile) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">Manage and track all delivery orders with bulk operations</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={viewOrdersOnMap} variant="outline">
              <MapPin className="mr-2 h-4 w-4" />
              View on Map
            </Button>
            <Button onClick={() => router.push("/admin/orders/create")}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        {/* Bulk Upload Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Bulk Operations</h3>
                  <p className="text-sm text-muted-foreground">Upload multiple orders or perform bulk actions</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleBulkUpload}
                    className="hidden"
                    id="bulk-upload"
                  />
                  <Button variant="outline" onClick={() => document.getElementById("bulk-upload")?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Orders
                  </Button>
                  <Button variant="outline" onClick={exportSelectedOrders}>
                    <Download className="mr-2 h-4 w-4" />
                    Export {selectedOrders.size > 0 ? `(${selectedOrders.size})` : "All"}
                  </Button>
                </div>
              </div>

              {/* Upload Progress */}
              {showBulkUpload && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{uploadStatus}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />

                  {uploadResult && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-900">Upload Results</h4>
                      <div className="mt-2 text-sm text-green-700">
                        <p>✅ {uploadResult.imported} orders imported successfully</p>
                        <p>📊 {uploadResult.total_processed} total orders processed</p>
                        {uploadResult.validation_errors && uploadResult.validation_errors.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-red-600">
                              ⚠️ {uploadResult.validation_errors.length} validation errors
                            </summary>
                            <ul className="mt-1 ml-4 list-disc text-red-600">
                              {uploadResult.validation_errors.slice(0, 5).map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                              {uploadResult.validation_errors.length > 5 && (
                                <li>... and {uploadResult.validation_errors.length - 5} more</li>
                              )}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk Actions */}
              {selectedOrders.size > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedOrders.size} orders selected</span>
                  <div className="flex gap-2 ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={bulkActionLoading}>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Assign Driver
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Select Driver</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {drivers.map((driver) => (
                          <DropdownMenuItem key={driver.id} onClick={() => handleBulkAssignDriver(driver.id)}>
                            {driver.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={bulkActionLoading}>
                          <Edit className="mr-2 h-4 w-4" />
                          Change Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Select Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("pending")}>Pending</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("assigned")}>Assigned</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("in_transit")}>
                          In Transit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("delivered")}>
                          Delivered
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("failed")}>Failed</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("cancelled")}>
                          Cancelled
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkActionLoading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Template Generator */}
        <OrderTemplateGenerator />

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders by number, customer, address, or driver..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchOrders}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              All ({getTabCount("all")})
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Active ({getTabCount("active")})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed ({getTabCount("completed")})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Failed ({getTabCount("failed")})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("all")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
            />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("active")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("completed")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
            />
          </TabsContent>

          <TabsContent value="failed" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("failed")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
            />
          </TabsContent>
        </Tabs>

        {/* Delivery Map Modal */}
        {showMap && (
          <DeliveryMap
            orders={mapOrders.map((order) => ({
              id: order.id,
              order_number: order.order_number,
              customer_name: order.customer_name,
              delivery_address: order.delivery_address,
              priority: order.priority,
              status: order.status,
            }))}
            driverLocation={null}
            onClose={() => setShowMap(false)}
            isOptimized={false}
          />
        )}
      </div>
    </DashboardLayout>
  )

  function OrdersList({
    orders,
    loading,
    selectedOrders,
    onSelectAll,
    onSelectOrder,
    allSelected,
    someSelected,
  }: {
    orders: OrderWithActions[]
    loading: boolean
    selectedOrders: Set<string>
    onSelectAll: (checked: boolean) => void
    onSelectOrder: (orderId: string, checked: boolean) => void
    allSelected: boolean
    someSelected: boolean
  }) {
    if (loading) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">Loading orders...</div>
          </CardContent>
        </Card>
      )
    }

    if (orders.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No orders found</h3>
              <p className="text-muted-foreground">
                {activeTab === "active"
                  ? "No active orders at the moment"
                  : activeTab === "completed"
                    ? "No completed deliveries yet"
                    : activeTab === "failed"
                      ? "No failed orders"
                      : "No orders match your current filters"}
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Select All Header */}
            <div className="flex items-center gap-3 pb-2 border-b">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected
                }}
              />
              <span className="text-sm font-medium">
                {allSelected ? "Deselect All" : someSelected ? "Select All" : "Select All"}
              </span>
              <span className="text-sm text-muted-foreground">({orders.length} orders)</span>
            </div>

            {/* Orders List */}
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start gap-3 p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <Checkbox
                    checked={selectedOrders.has(order.id)}
                    onCheckedChange={(checked) => onSelectOrder(order.id, checked as boolean)}
                    className="mt-1"
                  />

                  <div className="flex-1 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">#{order.order_number}</h3>
                        {getStatusBadge(order.status)}
                        {getPriorityBadge(order.priority)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Order Details */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{order.customer_name}</span>
                        </div>
                        {order.customer_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{order.customer_phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">Delivery Address</p>
                            <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Driver</p>
                            <p className="text-sm text-muted-foreground">{order.driver_name || "Unassigned"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Notes */}
                    {order.delivery_notes && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">Notes:</span> {order.delivery_notes}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                        <FileText className="mr-1 h-3 w-3" />
                        View Details
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`,
                          )
                        }
                      >
                        <MapPin className="mr-1 h-3 w-3" />
                        View Location
                      </Button>

                      {order.status === "delivered" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/orders/${order.id}/pod`)}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          View POD
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/admin/orders/${order.id}`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Order
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkAssignDriver(order.driver_id || "")}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Assign Driver
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleBulkDelete()} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
}
