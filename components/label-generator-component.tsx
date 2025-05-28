"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { LabelGenerator, type LabelData } from "@/lib/label-generator"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Printer, Package, Loader2, QrCode, CheckCircle } from "lucide-react"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  delivery_address: string
  pickup_address: string
  priority: string
  delivery_notes?: string
  created_at: string
  driver_name?: string
  status: string
}

interface LabelGeneratorProps {
  orders: Order[]
  onLabelGenerated?: (orderId: string, labelUrl: string) => void
}

export function LabelGeneratorComponent({ orders, onLabelGenerated }: LabelGeneratorProps) {
  const { toast } = useToast()
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)
  const [customWeight, setCustomWeight] = useState("")
  const [customDimensions, setCustomDimensions] = useState("")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [labelType, setLabelType] = useState<"individual" | "batch">("individual")
  const [generatedLabels, setGeneratedLabels] = useState<Map<string, string>>(new Map())

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders)
    if (checked) {
      newSelected.add(orderId)
    } else {
      newSelected.delete(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(orders.map((order) => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const generateSingleLabel = async (order: Order) => {
    setIsGenerating(true)
    try {
      // Validate required fields
      if (!order.order_number || !order.customer_name) {
        throw new Error("Missing required order information")
      }

      const labelData: LabelData = {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address || "Address not provided",
        pickupAddress: order.pickup_address || "Pickup address not provided",
        priority: order.priority || "normal",
        weight: customWeight || undefined,
        dimensions: customDimensions || undefined,
        specialInstructions: order.delivery_notes || additionalNotes || undefined,
        createdDate: new Date(order.created_at).toLocaleDateString(),
        driverName: order.driver_name,
      }

      const labelBlob = await LabelGenerator.generateLabel(labelData)
      const filename = `label-${order.order_number}.pdf`

      // Save label to database
      await saveLabelToDatabase(order.id, order.order_number, labelBlob)

      LabelGenerator.downloadLabel(labelBlob, filename)

      const newLabels = new Map(generatedLabels)
      newLabels.set(order.id, filename)
      setGeneratedLabels(newLabels)

      toast({
        title: "Label Generated",
        description: `Label for order ${order.order_number} has been generated and downloaded.`,
      })

      onLabelGenerated?.(order.id, filename)
    } catch (error) {
      console.error("Error generating label:", error)
      toast({
        title: "Error",
        description: "Failed to generate label. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateBatchLabels = async () => {
    if (selectedOrders.size === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select at least one order to generate labels.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const selectedOrderData = orders.filter((order) => selectedOrders.has(order.id))

      const labelDataArray: LabelData[] = selectedOrderData.map((order) => ({
        orderNumber: order.order_number || "UNKNOWN",
        customerName: order.customer_name || "Unknown Customer",
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address || "Address not provided",
        pickupAddress: order.pickup_address || "Pickup address not provided",
        priority: order.priority || "normal",
        weight: customWeight || undefined,
        dimensions: customDimensions || undefined,
        specialInstructions: order.delivery_notes || additionalNotes || undefined,
        createdDate: new Date(order.created_at).toLocaleDateString(),
        driverName: order.driver_name,
      }))

      const batchBlob = await LabelGenerator.generateBatchLabels(labelDataArray)
      const filename = `batch-labels-${new Date().toISOString().split("T")[0]}.pdf`

      // Save batch labels to database
      for (const order of selectedOrderData) {
        await saveLabelToDatabase(order.id, order.order_number, batchBlob, "batch")
      }

      LabelGenerator.downloadLabel(batchBlob, filename)

      toast({
        title: "Batch Labels Generated",
        description: `${selectedOrders.size} labels have been generated and downloaded.`,
      })

      // Mark all selected orders as having labels generated
      const newLabels = new Map(generatedLabels)
      selectedOrderData.forEach((order) => {
        newLabels.set(order.id, filename)
        onLabelGenerated?.(order.id, filename)
      })
      setGeneratedLabels(newLabels)
      setSelectedOrders(new Set())
    } catch (error) {
      console.error("Error generating batch labels:", error)
      toast({
        title: "Error",
        description: "Failed to generate batch labels. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const printLabel = async (order: Order) => {
    try {
      // Validate required fields
      if (!order.order_number || !order.customer_name) {
        throw new Error("Missing required order information")
      }

      const labelData: LabelData = {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address || "Address not provided",
        pickupAddress: order.pickup_address || "Pickup address not provided",
        priority: order.priority || "normal",
        weight: customWeight || undefined,
        dimensions: customDimensions || undefined,
        specialInstructions: order.delivery_notes || additionalNotes || undefined,
        createdDate: new Date(order.created_at).toLocaleDateString(),
        driverName: order.driver_name,
      }

      const labelBlob = await LabelGenerator.generateLabel(labelData)
      await LabelGenerator.printLabel(labelBlob)

      // Update print count in database
      await updateLabelPrintCount(order.id)

      toast({
        title: "Label Sent to Printer",
        description: `Label for order ${order.order_number} has been sent to the printer.`,
      })
    } catch (error) {
      console.error("Error printing label:", error)
      toast({
        title: "Error",
        description: "Failed to print label. Please try again.",
        variant: "destructive",
      })
    }
  }

  const saveLabelToDatabase = async (orderId: string, barcodeData: string, labelBlob: Blob, labelType = "standard") => {
    try {
      // Convert blob to base64 for storage (in a real app, you'd upload to cloud storage)
      const base64Data = await blobToBase64(labelBlob)

      const response = await fetch("/api/labels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          barcodeData,
          labelType,
          labelData: base64Data,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save label to database")
      }
    } catch (error) {
      console.error("Error saving label to database:", error)
    }
  }

  const updateLabelPrintCount = async (orderId: string) => {
    try {
      await fetch("/api/labels/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      })
    } catch (error) {
      console.error("Error updating print count:", error)
    }
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64.split(",")[1]) // Remove data:application/pdf;base64, prefix
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const allSelected = orders.length > 0 && orders.every((order) => selectedOrders.has(order.id))
  const someSelected = orders.some((order) => selectedOrders.has(order.id))

  return (
    <div className="space-y-6">
      {/* Label Generation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Label Generator Settings
          </CardTitle>
          <CardDescription>Configure label generation options and package details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Package Weight</Label>
              <Input
                id="weight"
                placeholder="e.g., 2.5 kg"
                value={customWeight}
                onChange={(e) => setCustomWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dimensions">Package Dimensions</Label>
              <Input
                id="dimensions"
                placeholder="e.g., 30x20x15 cm"
                value={customDimensions}
                onChange={(e) => setCustomDimensions(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labelType">Label Type</Label>
              <Select value={labelType} onValueChange={(value: "individual" | "batch") => setLabelType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual Labels</SelectItem>
                  <SelectItem value="batch">Batch Labels</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional instructions or notes for all labels..."
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Batch Operations */}
      {labelType === "batch" && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Label Generation</CardTitle>
            <CardDescription>Select multiple orders to generate labels in a single PDF</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                />
                <span className="text-sm font-medium">
                  {allSelected ? "Deselect All" : someSelected ? "Select All" : "Select All"}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({selectedOrders.size} of {orders.length} selected)
                </span>
              </div>

              <Button
                onClick={generateBatchLabels}
                disabled={selectedOrders.size === 0 || isGenerating}
                className="flex items-center gap-2"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Generate Batch Labels ({selectedOrders.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({orders.length})</CardTitle>
          <CardDescription>Generate shipping labels with barcodes for your orders</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No orders available</h3>
              <p className="text-muted-foreground">Create some orders first to generate labels.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {labelType === "batch" && (
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                      />
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">#{order.order_number}</h4>
                        <Badge variant={order.priority === "urgent" ? "destructive" : "outline"}>
                          {order.priority}
                        </Badge>
                        {generatedLabels.has(order.id) && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Label Generated
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.customer_name} • {order.delivery_address.substring(0, 50)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(order.created_at).toLocaleDateString()}
                        {order.driver_name && ` • Driver: ${order.driver_name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateSingleLabel(order)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => printLabel(order)} disabled={isGenerating}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
