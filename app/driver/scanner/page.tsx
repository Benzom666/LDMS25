"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import {
  ArrowLeft,
  Package,
  MapPin,
  User,
  Phone,
  CheckCircle,
  AlertTriangle,
  Scan,
  Type,
  Plus,
  Eye,
  Settings,
  X,
  Loader2,
} from "lucide-react"

interface OrderInfo {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  delivery_address: string
  status: string
  priority: string
  driver_id?: string
  created_at: string
}

interface ScannedParcel {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  status: string
  priority: string
  driver_id?: string
  scanned_at: string
}

export default function ScannerPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [manualEntry, setManualEntry] = useState("")
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [scannedParcels, setScannedParcels] = useState<ScannedParcel[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // Check if browser supports camera
    if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Camera Not Supported",
        description: "Your browser does not support camera access required for scanning.",
        variant: "destructive",
      })
    }
  }, [toast])

  const processBarcode = async (barcodeData: string) => {
    if (!barcodeData.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid order number.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      // Look up order by barcode/order number
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .or(`order_number.eq.${barcodeData},id.eq.${barcodeData}`)
        .single()

      if (error || !orders) {
        toast({
          title: "Order Not Found",
          description: `No order found for: ${barcodeData}`,
          variant: "destructive",
        })
        return
      }

      // Check if already scanned
      const alreadyScanned = scannedParcels.find((p) => p.id === orders.id)
      if (alreadyScanned) {
        toast({
          title: "Already Scanned",
          description: `Order #${orders.order_number} has already been scanned.`,
          variant: "destructive",
        })
        return
      }

      setOrderInfo(orders)

      // Create scanned parcel object
      const scannedParcel: ScannedParcel = {
        id: orders.id,
        order_number: orders.order_number,
        customer_name: orders.customer_name,
        delivery_address: orders.delivery_address,
        status: orders.status,
        priority: orders.priority,
        driver_id: orders.driver_id,
        scanned_at: new Date().toISOString(),
      }

      setScannedParcels((prev) => [...prev, scannedParcel])

      toast({
        title: "Order Found",
        description: `Successfully scanned order #${orders.order_number}`,
      })
    } catch (error) {
      console.error("Error processing barcode:", error)
      toast({
        title: "Error",
        description: "Failed to process barcode. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualEntry = async () => {
    await processBarcode(manualEntry.trim())
    setManualEntry("")
  }

  const handleParcelAction = async (parcel: ScannedParcel, action: "add" | "details" | "manage") => {
    switch (action) {
      case "add":
        await assignParcelToDriver(parcel)
        break
      case "details":
        router.push(`/driver/orders/${parcel.id}`)
        break
      case "manage":
        router.push(`/driver/orders/${parcel.id}/edit`)
        break
    }
  }

  const assignParcelToDriver = async (parcel: ScannedParcel) => {
    if (!profile) return

    try {
      // Check if already assigned to this driver
      if (parcel.driver_id === profile.user_id) {
        toast({
          title: "Already Assigned",
          description: `Order #${parcel.order_number} is already assigned to you.`,
          variant: "destructive",
        })
        return
      }

      // Assign to driver
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: profile.user_id,
          status: "assigned",
          assigned_at: new Date().toISOString(),
        })
        .eq("id", parcel.id)

      if (error) throw error

      // Update scanned parcel
      setScannedParcels((prev) =>
        prev.map((p) => (p.id === parcel.id ? { ...p, driver_id: profile.user_id, status: "assigned" } : p)),
      )

      toast({
        title: "Parcel Assigned",
        description: `Order #${parcel.order_number} has been assigned to you.`,
      })
    } catch (error) {
      console.error("Error assigning parcel:", error)
      toast({
        title: "Error",
        description: "Failed to assign parcel. Please try again.",
        variant: "destructive",
      })
    }
  }

  const removeScannedParcel = (parcelId: string) => {
    setScannedParcels((prev) => prev.filter((p) => p.id !== parcelId))
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any }> = {
      assigned: { color: "bg-blue-100 text-blue-800", icon: Package },
      picked_up: { color: "bg-indigo-100 text-indigo-800", icon: Package },
      in_transit: { color: "bg-purple-100 text-purple-800", icon: Package },
      delivered: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-800", icon: AlertTriangle },
    }

    const config = statusConfig[status] || statusConfig.assigned
    const Icon = config.icon

    return (
      <Badge className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { color: string }> = {
      urgent: { color: "bg-red-100 text-red-800" },
      high: { color: "bg-orange-100 text-orange-800" },
      normal: { color: "bg-blue-100 text-blue-800" },
      low: { color: "bg-gray-100 text-gray-800" },
    }

    const config = priorityConfig[priority] || priorityConfig.normal

    return <Badge className={config.color}>{priority}</Badge>
  }

  const goToOptimizeRoute = () => {
    router.push("/driver/orders")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Barcode Scanner</h1>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Manual Entry Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Scan or Enter Order Number
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Order Number or Barcode</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter order number or scan barcode..."
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleManualEntry()}
                className="flex-1"
              />
              <Button onClick={handleManualEntry} disabled={isProcessing || !manualEntry.trim()}>
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" />
                )}
                {isProcessing ? "Processing..." : "Add"}
              </Button>
            </div>
          </div>

          {/* Current Order Info */}
          {orderInfo && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-medium text-green-800 mb-2">Last Scanned Order</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">#{orderInfo.order_number}</span>
                  {getStatusBadge(orderInfo.status)}
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>{orderInfo.customer_name}</span>
                </div>
                {orderInfo.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{orderInfo.customer_phone}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                  <span className="text-xs">{orderInfo.delivery_address}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned Parcels Display */}
      {scannedParcels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Scanned Parcels ({scannedParcels.length})
              </div>
              <Button onClick={goToOptimizeRoute}>
                <Scan className="mr-2 h-4 w-4" />
                Optimize Route
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scannedParcels.map((parcel) => (
                <div key={parcel.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">#{parcel.order_number}</span>
                      {getStatusBadge(parcel.status)}
                      {getPriorityBadge(parcel.priority)}
                    </div>
                    <p className="text-sm text-gray-600">{parcel.customer_name}</p>
                    <p className="text-xs text-gray-500">{parcel.delivery_address}</p>
                    <p className="text-xs text-gray-400">Scanned: {new Date(parcel.scanned_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {parcel.driver_id !== profile?.user_id && (
                      <Button size="sm" onClick={() => handleParcelAction(parcel, "add")} className="text-xs">
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleParcelAction(parcel, "details")}
                      className="text-xs"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleParcelAction(parcel, "manage")}
                      className="text-xs"
                    >
                      <Settings className="mr-1 h-3 w-3" />
                      Manage
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeScannedParcel(parcel.id)}
                      className="text-xs text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {scannedParcels.length > 0 && (
              <div className="flex justify-between items-center pt-4 border-t mt-4">
                <span className="text-sm text-gray-600">
                  {scannedParcels.filter((p) => p.driver_id === profile?.user_id).length} assigned to you
                </span>
                <Button onClick={goToOptimizeRoute}>Go to Orders & Optimize Route</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            How to Use
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Scan or Enter Order Numbers</p>
                <p className="text-gray-600">Use the input field above to enter order numbers or barcode data.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Add Parcels to Your Route</p>
                <p className="text-gray-600">
                  Click "Add" to assign unassigned parcels to yourself, or use "Details" to view order information.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Optimize Your Route</p>
                <p className="text-gray-600">
                  Once you've scanned all parcels, click "Optimize Route" to create an efficient delivery sequence.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
