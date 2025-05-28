"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import {
  Camera,
  CameraOff,
  Package,
  MapPin,
  User,
  Phone,
  CheckCircle,
  AlertTriangle,
  Scan,
  Type,
  History,
  Plus,
  Eye,
  Settings,
  X,
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

interface ScanRecord {
  id: string
  order_id: string
  scan_type: string
  barcode_data: string
  notes?: string
  scanned_at: string
  order?: OrderInfo
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

interface BarcodeScannerComponentProps {
  onParcelScanned?: (parcel: ScannedParcel) => void
  onParcelAction?: (parcel: ScannedParcel, action: "add" | "details" | "manage") => void
  scannedParcels?: ScannedParcel[]
  onRemoveParcel?: (parcelId: string) => void
}

export function BarcodeScannerComponent({
  onParcelScanned,
  onParcelAction,
  scannedParcels = [],
  onRemoveParcel,
}: BarcodeScannerComponentProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [manualEntry, setManualEntry] = useState("")
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [scanType, setScanType] = useState<"pickup" | "delivery" | "checkpoint">("delivery")
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    loadScanHistory()
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraEnabled(false)
    setIsScanning(false)
  }

  const loadScanHistory = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from("parcel_scans")
        .select(`
          *,
          order:orders(*)
        `)
        .eq("driver_id", profile.user_id)
        .order("scanned_at", { ascending: false })
        .limit(10)

      if (error) throw error
      setScanHistory(data || [])
    } catch (error) {
      console.error("Error loading scan history:", error)
    }
  }

  const initializeCamera = async () => {
    if (!videoRef.current) return

    try {
      setLoading(true)

      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      setStream(mediaStream)
      videoRef.current.srcObject = mediaStream

      await new Promise((resolve, reject) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            resolve(true)
          }
          videoRef.current.onerror = reject
        }
      })

      setCameraEnabled(true)
      toast({
        title: "Camera Ready",
        description: "Camera initialized successfully. You can now start scanning.",
      })
    } catch (error) {
      console.error("Camera initialization failed:", error)
      toast({
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const startScanning = () => {
    if (!cameraEnabled) {
      initializeCamera()
      return
    }

    setIsScanning(true)
    toast({
      title: "Scanning Started",
      description: "Point the camera at a barcode to scan.",
    })

    // Simulate barcode detection (in real implementation, use a barcode library)
    const scanInterval = setInterval(() => {
      if (!isScanning) {
        clearInterval(scanInterval)
        return
      }

      // For demo purposes, we'll simulate finding a barcode after a few seconds
      // In real implementation, this would be handled by a barcode detection library
    }, 1000)
  }

  const stopScanning = () => {
    setIsScanning(false)
  }

  const processBarcode = async (barcodeData: string) => {
    setLoading(true)
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
          description: `No order found for barcode: ${barcodeData}`,
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

      // Record the scan
      await recordScan(orders.id, barcodeData)

      // Notify parent component
      if (onParcelScanned) {
        onParcelScanned(scannedParcel)
      }

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
      setLoading(false)
    }
  }

  const recordScan = async (orderId: string, barcodeData: string) => {
    if (!profile) return

    try {
      const { error } = await supabase.from("parcel_scans").insert({
        order_id: orderId,
        driver_id: profile.user_id,
        scan_type: scanType,
        barcode_data: barcodeData,
        location_lat: null, // Could add geolocation here
        location_lng: null,
        notes: `${scanType} scan by driver`,
      })

      if (error) throw error

      // Update order status based on scan type
      if (scanType === "pickup") {
        await supabase.from("orders").update({ status: "picked_up" }).eq("id", orderId)
      } else if (scanType === "delivery") {
        await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId)
      }

      loadScanHistory()
    } catch (error) {
      console.error("Error recording scan:", error)
    }
  }

  const handleManualEntry = async () => {
    if (!manualEntry.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter an order number.",
        variant: "destructive",
      })
      return
    }

    await processBarcode(manualEntry.trim())
    setManualEntry("")
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

  const getScanTypeBadge = (type: string) => {
    const typeConfig: Record<string, { color: string; label: string }> = {
      pickup: { color: "bg-blue-100 text-blue-800", label: "Pickup" },
      delivery: { color: "bg-green-100 text-green-800", label: "Delivery" },
      checkpoint: { color: "bg-yellow-100 text-yellow-800", label: "Checkpoint" },
    }

    const config = typeConfig[type] || typeConfig.delivery

    return <Badge className={config.color}>{config.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scan Type Selection */}
            <div className="flex gap-2">
              {["pickup", "delivery", "checkpoint"].map((type) => (
                <Button
                  key={type}
                  variant={scanType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScanType(type as any)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>

            {/* Video Element */}
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {!cameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <CameraOff className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Camera not initialized</p>
                  </div>
                </div>
              )}
              {isScanning && (
                <div className="absolute inset-0 border-4 border-green-500 animate-pulse">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-48 h-32 border-2 border-green-500 bg-green-500/10"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Scanner Controls */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button onClick={startScanning} disabled={loading} className="flex-1">
                  <Scan className="mr-2 h-4 w-4" />
                  {cameraEnabled ? "Start Scanning" : "Initialize Camera"}
                </Button>
              ) : (
                <Button onClick={stopScanning} variant="destructive" className="flex-1">
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Scanning
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manual Entry Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Order Number</label>
              <Input
                placeholder="Enter order number manually"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleManualEntry()}
              />
            </div>
            <Button onClick={handleManualEntry} disabled={loading || !manualEntry.trim()} className="w-full">
              <Package className="mr-2 h-4 w-4" />
              Process Order
            </Button>

            {/* Current Order Info */}
            {orderInfo && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800 mb-2">Current Order</h3>
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
      </div>

      {/* Scanned Parcels Display */}
      {scannedParcels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Scanned Parcels ({scannedParcels.length})
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
                    </div>
                    <p className="text-sm text-gray-600">{parcel.customer_name}</p>
                    <p className="text-xs text-gray-500">{parcel.delivery_address}</p>
                    <p className="text-xs text-gray-400">Scanned: {new Date(parcel.scanned_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {parcel.driver_id !== profile?.user_id && onParcelAction && (
                      <Button size="sm" onClick={() => onParcelAction(parcel, "add")} className="text-xs">
                        <Plus className="mr-1 h-3 w-3" />
                        Add
                      </Button>
                    )}
                    {onParcelAction && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onParcelAction(parcel, "details")}
                          className="text-xs"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onParcelAction(parcel, "manage")}
                          className="text-xs"
                        >
                          <Settings className="mr-1 h-3 w-3" />
                          Manage
                        </Button>
                      </>
                    )}
                    {onRemoveParcel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveParcel(parcel.id)}
                        className="text-xs text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Scans
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scanHistory.length === 0 ? (
            <div className="text-center py-8">
              <Scan className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-gray-500">No scans recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scanHistory.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">#{scan.barcode_data}</span>
                      <span className="text-xs text-gray-500">{new Date(scan.scanned_at).toLocaleString()}</span>
                    </div>
                    {getScanTypeBadge(scan.scan_type)}
                  </div>
                  <div className="flex items-center gap-2">{scan.order && getStatusBadge(scan.order.status)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BarcodeScannerComponent
