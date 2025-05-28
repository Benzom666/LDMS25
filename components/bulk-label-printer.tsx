"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { LabelGenerator, type LabelData } from "@/lib/label-generator"
import { supabase } from "@/lib/supabase"
import { Printer, Download, FileText, Loader2, Package, Filter, RefreshCw } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  delivery_address: string
  pickup_address: string
  status: string
  priority: string
  driver_id?: string
  driver_name?: string
  created_at: string
  weight?: string
  dimensions?: string
  delivery_notes?: string
}

export function BulkLabelPrinter() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch orders from the database
  const fetchOrders = async () => {
    setLoading(true)
    try {
      let query = supabase.from("orders").select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        delivery_address,
        pickup_address,
        status,
        priority,
        driver_id,
        created_at,
        weight,
        dimensions,
        delivery_notes,
        drivers:driver_id (
          full_name
        )
      `)

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query.order("created_at", { ascending: false })

      if (error) throw error

      const formattedOrders = data.map((order) => ({
        ...order,
        driver_name: order.drivers?.full_name || "Unassigned",
      }))

      setOrders(formattedOrders)
      setSelectedOrders([])
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to fetch orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Generate and download labels for selected orders
  const generateLabels = async (action: "download" | "print") => {
    if (selectedOrders.length === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select at least one order to generate labels.",
        variant: "destructive",
      })
      return
    }

    setGenerating(true)
    try {
      // Get selected order data
      const selectedOrderData = orders.filter((order) => selectedOrders.includes(order.id))

      // Convert to label data format
      const labelDataArray: LabelData[] = selectedOrderData.map((order) => ({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        pickupAddress: order.pickup_address || "No pickup address provided",
        priority: order.priority,
        weight: order.weight,
        dimensions: order.dimensions,
        specialInstructions: order.delivery_notes,
        createdDate: new Date(order.created_at).toLocaleDateString(),
        driverName: order.driver_name,
      }))

      // Generate batch labels
      const labelBlob = await LabelGenerator.generateBatchLabels(labelDataArray)

      if (action === "download") {
        // Download the labels
        const filename =
          selectedOrders.length === 1
            ? `label-${selectedOrderData[0].order_number}.pdf`
            : `labels-batch-${new Date().toISOString().slice(0, 10)}.pdf`

        LabelGenerator.downloadLabel(labelBlob, filename)

        toast({
          title: "Labels Generated",
          description: `${selectedOrders.length} label(s) have been generated and downloaded.`,
        })
      } else {
        // Print the labels
        await LabelGenerator.printLabel(labelBlob)

        toast({
          title: "Labels Sent to Printer",
          description: `${selectedOrders.length} label(s) have been sent to the printer.`,
        })
      }
    } catch (error) {
      console.error("Error generating labels:", error)
      toast({
        title: "Error",
        description: "Failed to generate labels. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  // Toggle selection of all orders
  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredOrders.map((order) => order.id))
    }
  }

  // Toggle selection of a single order
  const toggleOrderSelection = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId))
    } else {
      setSelectedOrders([...selectedOrders, orderId])
    }
  }

  // Filter orders based on search term
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(searchLower) ||
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.delivery_address.toLowerCase().includes(searchLower) ||
      order.driver_name.toLowerCase().includes(searchLower)
    )
  })

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800"
      case "assigned":
        return "bg-blue-100 text-blue-800"
      case "in_transit":
        return "bg-orange-100 text-orange-800"
      case "delivered":
        return "bg-green-100 text-green-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "normal":
        return "bg-blue-100 text-blue-800"
      case "low":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Bulk Label Printer
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchOrders}>
              Apply
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              {selectedOrders.length === 0
                ? "Select All"
                : selectedOrders.length === filteredOrders.length
                  ? "Deselect All"
                  : `${selectedOrders.length} Selected`}
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateLabels("download")}
              disabled={generating || selectedOrders.length === 0}
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download Labels
            </Button>
            <Button onClick={() => generateLabels("print")} disabled={generating || selectedOrders.length === 0}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print Labels
            </Button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">No orders found</p>
            <Button variant="outline" className="mt-4" onClick={fetchOrders}>
              Refresh Orders
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`p-4 border rounded-md ${
                  selectedOrders.includes(order.id) ? "border-blue-500 bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedOrders.includes(order.id)}
                    onCheckedChange={() => toggleOrderSelection(order.id)}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium">#{order.order_number}</span>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                        {order.status.replace("_", " ")}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">{order.customer_name}</div>
                    <div className="text-xs text-gray-500 mt-1">{order.delivery_address}</div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Driver: {order.driver_name}</span>
                      <span>Created: {new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedOrders([order.id])
                      generateLabels("download")
                    }}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {filteredOrders.length} orders • {selectedOrders.length} selected
            </div>
            {selectedOrders.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedOrders([])}>
                  Clear Selection
                </Button>
                <Button size="sm" onClick={() => generateLabels("print")} disabled={generating}>
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Print {selectedOrders.length} Labels
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
