"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { barcodeScanner, type ScanResult } from "@/lib/barcode-scanner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import {
  Camera,
  CameraOff,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Scan,
  History,
  Plus,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react"

interface ScanHistoryItem {
  id: string
  order_number: string
  scan_type: string
  scan_timestamp: string
  location_latitude?: number
  location_longitude?: number
  notes?: string
  customer_name?: string
  delivery_address?: string
}

interface ParcelInfo {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  status: string
  priority: string
  driver_name?: string
}

export function BarcodeScannerComponent() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [parcelInfo, setParcelInfo] = useState<ParcelInfo | null>(null)
  const [scanType, setScanType] = useState<string>("pickup")
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [manualOrderNumber, setManualOrderNumber] = useState("")
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null)
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([])
  const scannerElementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkCameraPermission()
    fetchScanHistory()
    return () => {
      stopScanning()
    }
  }, [])

  const checkCameraPermission = async () => {
    const hasPermission = await barcodeScanner.getCameraPermissions()
    setCameraPermission(hasPermission)

    if (hasPermission) {
      const cameras = await barcodeScanner.getAvailableCameras()
      setAvailableCameras(cameras)
    }
  }

  const startScanning = async () => {
    if (!cameraPermission) {
      toast({
        title: "Camera Permission Required",
        description: "Please allow camera access to scan barcodes.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsScanning(true)
      await barcodeScanner.initializeScanner("barcode-scanner", handleScanSuccess, handleScanError)
    } catch (error) {
      console.error("Failed to start scanning:", error)
      toast({
        title: "Scanner Error",
        description: "Failed to start the barcode scanner. Please try again.",
        variant: "destructive",
      })
      setIsScanning(false)
    }
  }

  const stopScanning = async () => {
    try {
      await barcodeScanner.stopScanning()
      setIsScanning(false)
    } catch (error) {
      console.error("Failed to stop scanning:", error)
    }
  }

  const handleScanSuccess = async (result: ScanResult) => {
    setScanResult(result)
    await fetchParcelInfo(result.orderNumber)

    toast({
      title: "Barcode Scanned",
      description: `Order ${result.orderNumber} detected`,
    })
  }

  const handleScanError = (error: string) => {
    console.warn("Scan error:", error)
  }

  const fetchParcelInfo = async (orderNumber: string) => {
    setIsLoading(true)
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          delivery_address,
          status,
          priority,
          driver_id
        `)
        .eq("order_number", orderNumber)
        .single()

      if (orderError) {
        throw new Error("Order not found")
      }

      // Get driver name if assigned
      let driverName = undefined
      if (orderData.driver_id) {
        const { data: driverData } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("user_id", orderData.driver_id)
          .single()

        if (driverData) {
          driverName = `${driverData.first_name} ${driverData.last_name}`.trim()
        }
      }

      setParcelInfo({
        ...orderData,
        driver_name: driverName,
      })
    } catch (error) {
      console.error("Error fetching parcel info:", error)
      toast({
        title: "Order Not Found",
        description: `No order found with number: ${orderNumber}`,
        variant: "destructive",
      })
      setParcelInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualEntry = async () => {
    if (!manualOrderNumber.trim()) {
      toast({
        title: "Order Number Required",
        description: "Please enter an order number to search.",
        variant: "destructive",
      })
      return
    }

    const result: ScanResult = {
      orderNumber: manualOrderNumber.trim(),
      timestamp: new Date().toISOString(),
    }

    setScanResult(result)
    await fetchParcelInfo(result.orderNumber)
  }

  const recordScan = async () => {
    if (!scanResult || !parcelInfo || !profile) {
      toast({
        title: "Missing Information",
        description: "Please scan a barcode first.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Record the scan
      const { error: scanError } = await supabase.from("parcel_scans").insert({
        order_id: parcelInfo.id,
        driver_id: profile.user_id,
        scan_type: scanType,
        barcode_data: scanResult.orderNumber,
        scan_timestamp: scanResult.timestamp,
        location_lat: scanResult.location?.latitude,
        location_lng: scanResult.location?.longitude,
        notes: notes.trim() || null,
      })

      if (scanError) throw scanError

      // Update order status based on scan type
      let newStatus = parcelInfo.status
      if (scanType === "pickup" && parcelInfo.status === "assigned") {
        newStatus = "picked_up"
      } else if (scanType === "delivery" && parcelInfo.status === "in_transit") {
        newStatus = "delivered"
      }

      if (newStatus !== parcelInfo.status) {
        const { error: statusError } = await supabase
          .from("orders")
          .update({ status: newStatus })
          .eq("id", parcelInfo.id)

        if (statusError) throw statusError
      }

      // Record status history
      const { error: historyError } = await supabase.from("order_status_history").insert({
        order_id: parcelInfo.id,
        old_status: parcelInfo.status,
        new_status: newStatus,
        changed_by: profile.user_id,
        scan_id: null, // We don't have the scan ID yet
        notes: notes.trim() || null,
        changed_at: scanResult.timestamp,
      })

      if (historyError) throw historyError

      toast({
        title: "Scan Recorded",
        description: `${scanType} scan recorded for order ${scanResult.orderNumber}`,
      })

      // Reset form
      setScanResult(null)
      setParcelInfo(null)
      setNotes("")
      setManualOrderNumber("")

      // Refresh scan history
      await fetchScanHistory()
    } catch (error) {
      console.error("Error recording scan:", error)
      toast({
        title: "Error",
        description: "Failed to record scan. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchScanHistory = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from("parcel_scans")
        .select(`
          id,
          scan_type,
          barcode_data,
          scan_timestamp,
          location_lat,
          location_lng,
          notes,
          orders!inner(
            order_number,
            customer_name,
            delivery_address
          )
        `)
        .eq("driver_id", profile.user_id)
        .order("scan_timestamp", { ascending: false })
        .limit(10)

      if (error) throw error

      const formattedHistory: ScanHistoryItem[] = (data || []).map((scan: any) => ({
        id: scan.id,
        order_number: scan.orders.order_number,
        scan_type: scan.scan_type,
        scan_timestamp: scan.scan_timestamp,
        location_latitude: scan.location_lat,
        location_longitude: scan.location_lng,
        notes: scan.notes,
        customer_name: scan.orders.customer_name,
        delivery_address: scan.orders.delivery_address,
      }))

      setScanHistory(formattedHistory)
    } catch (error) {
      console.error("Error fetching scan history:", error)
    }
  }

  const getScanTypeBadge = (type: string) => {
    const config = {
      pickup: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Package, label: "Pickup" },
      delivery: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Delivery" },
      checkpoint: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: MapPin, label: "Checkpoint" },
      return: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, label: "Return" },
      damage: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, label: "Damage" },
    }

    const typeConfig = config[type as keyof typeof config] || config.checkpoint
    const Icon = typeConfig.icon

    return (
      <Badge variant="outline" className={typeConfig.color}>
        <Icon className="mr-1 h-3 w-3" />
        {typeConfig.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Camera Permission Check */}
      {cameraPermission === false && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">Camera permission is required to scan barcodes.</p>
              <Button variant="outline" size="sm" onClick={checkCameraPermission}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Barcode Scanner
          </CardTitle>
          <CardDescription>Scan package barcodes or enter order numbers manually</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={isScanning ? stopScanning : startScanning}
              disabled={cameraPermission === false}
              className="flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <CameraOff className="h-4 w-4" />
                  Stop Scanner
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Start Scanner
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Label htmlFor="manual-entry">Or enter manually:</Label>
              <Input
                id="manual-entry"
                placeholder="Order number..."
                value={manualOrderNumber}
                onChange={(e) => setManualOrderNumber(e.target.value)}
                className="w-40"
              />
              <Button variant="outline" onClick={handleManualEntry}>
                Search
              </Button>
            </div>
          </div>

          {/* Scanner Element */}
          {isScanning && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div id="barcode-scanner" ref={scannerElementRef} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Scanned Order: {scanResult.orderNumber}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setScanResult(null)
                  setParcelInfo(null)
                  setNotes("")
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading order information...</span>
              </div>
            ) : parcelInfo ? (
              <div className="space-y-4">
                {/* Order Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Order Details</h4>
                    <p className="text-sm">
                      <strong>Customer:</strong> {parcelInfo.customer_name}
                    </p>
                    <p className="text-sm">
                      <strong>Status:</strong> {parcelInfo.status}
                    </p>
                    <p className="text-sm">
                      <strong>Priority:</strong> {parcelInfo.priority}
                    </p>
                    {parcelInfo.driver_name && (
                      <p className="text-sm">
                        <strong>Driver:</strong> {parcelInfo.driver_name}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Delivery Address</h4>
                    <p className="text-sm text-muted-foreground">{parcelInfo.delivery_address}</p>
                  </div>
                </div>

                {/* Scan Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="scan-type">Scan Type</Label>
                  <Select value={scanType} onValueChange={setScanType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Pickup</SelectItem>
                      <SelectItem value="delivery">Delivery</SelectItem>
                      <SelectItem value="checkpoint">Checkpoint</SelectItem>
                      <SelectItem value="return">Return</SelectItem>
                      <SelectItem value="damage">Damage Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this scan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Location Info */}
                {scanResult.location && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm font-medium">Location captured</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {scanResult.location.latitude.toFixed(6)}, {scanResult.location.longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                {/* Record Button */}
                <Button onClick={recordScan} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Record {scanType} Scan
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Order Not Found</h3>
                <p className="text-muted-foreground">No order found with number: {scanResult.orderNumber}</p>
              </div>
            )}
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
          <CardDescription>Your recent barcode scan history</CardDescription>
        </CardHeader>
        <CardContent>
          {scanHistory.length === 0 ? (
            <div className="text-center py-8">
              <Scan className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No scans yet</h3>
              <p className="text-muted-foreground">Start scanning barcodes to see your history here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scanHistory.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{scan.order_number}</span>
                      {getScanTypeBadge(scan.scan_type)}
                    </div>
                    <p className="text-sm">{scan.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{scan.delivery_address.substring(0, 50)}...</p>
                    {scan.notes && <p className="text-xs text-muted-foreground">Note: {scan.notes}</p>}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(scan.scan_timestamp).toLocaleString()}
                    </div>
                    {scan.location_latitude && scan.location_longitude && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        Location recorded
                      </div>
                    )}
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
