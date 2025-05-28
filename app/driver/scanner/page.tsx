"use client"

import { useState, useEffect, useRef } from "react"
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
  Camera,
  CameraOff,
  RefreshCw,
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scannerRef = useRef<any>(null)

  const [loading, setLoading] = useState(false)
  const [manualEntry, setManualEntry] = useState("")
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [scannedParcels, setScannedParcels] = useState<ScannedParcel[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>("")
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    checkCameraPermission()
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    if (scannerRef.current) {
      scannerRef.current.stop?.()
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  const checkCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermission(false)
        toast({
          title: "Camera Not Supported",
          description: "Your browser does not support camera access.",
          variant: "destructive",
        })
        return
      }

      // Request permission
      const testStream = await navigator.mediaDevices.getUserMedia({ video: true })
      testStream.getTracks().forEach((track) => track.stop())

      setCameraPermission(true)

      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter((device) => device.kind === "videoinput")
      setAvailableCameras(cameras)

      // Select back camera by default
      const backCamera = cameras.find(
        (camera) =>
          camera.label.toLowerCase().includes("back") ||
          camera.label.toLowerCase().includes("rear") ||
          camera.label.toLowerCase().includes("environment"),
      )
      setSelectedCamera(backCamera?.deviceId || cameras[0]?.deviceId || "")
    } catch (error) {
      console.error("Camera permission error:", error)
      setCameraPermission(false)
      toast({
        title: "Camera Permission Denied",
        description: "Please allow camera access to use barcode scanning.",
        variant: "destructive",
      })
    }
  }

  const initializeCamera = async () => {
    if (!videoRef.current || !cameraPermission) return

    try {
      setLoading(true)

      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      // Start new stream
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          facingMode: selectedCamera ? undefined : { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
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

      toast({
        title: "Camera Ready",
        description: "Camera initialized successfully. Click 'Start Scanning' to begin.",
      })
    } catch (error) {
      console.error("Camera initialization failed:", error)
      toast({
        title: "Camera Error",
        description: "Failed to initialize camera. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const startScanning = async () => {
    if (!videoRef.current || !canvasRef.current) return

    try {
      // Initialize camera if not already done
      if (!stream) {
        await initializeCamera()
        return
      }

      setIsScanning(true)

      // Import the barcode detection library dynamically
      const { BrowserMultiFormatReader } = await import("@zxing/library")

      scannerRef.current = new BrowserMultiFormatReader()

      // Start scanning
      scannerRef.current.decodeFromVideoDevice(
        selectedCamera || undefined,
        videoRef.current,
        (result: any, error: any) => {
          if (result) {
            const barcodeText = result.getText()
            handleBarcodeDetected(barcodeText)
          }
          if (error && !(error.name === "NotFoundException")) {
            console.warn("Barcode scan error:", error)
          }
        },
      )

      toast({
        title: "Scanning Started",
        description: "Point the camera at a barcode to scan.",
      })
    } catch (error) {
      console.error("Failed to start scanning:", error)
      toast({
        title: "Scanner Error",
        description: "Failed to start barcode scanner. Please try manual entry.",
        variant: "destructive",
      })
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.reset()
      scannerRef.current = null
    }
    setIsScanning(false)

    toast({
      title: "Scanning Stopped",
      description: "Barcode scanning has been stopped.",
    })
  }

  const handleBarcodeDetected = async (barcodeText: string) => {
    // Stop scanning temporarily to prevent multiple scans
    setIsScanning(false)

    toast({
      title: "Barcode Detected",
      description: `Scanned: ${barcodeText}`,
    })

    // Process the barcode
    await processBarcode(barcodeText)

    // Resume scanning after a short delay
    setTimeout(() => {
      if (scannerRef.current) {
        setIsScanning(true)
      }
    }, 2000)
  }

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

      // Record the scan in database
      await recordScan(orders.id, barcodeData)

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

  const recordScan = async (orderId: string, barcodeData: string) => {
    if (!profile) return

    try {
      const { error } = await supabase.from("parcel_scans").insert({
        order_id: orderId,
        driver_id: profile.user_id,
        scan_type: "pickup", // Default scan type
        barcode_data: barcodeData,
        location_lat: null, // Could add geolocation here
        location_lng: null,
        notes: "Scanned via mobile scanner",
      })

      if (error) throw error
    } catch (error) {
      console.error("Error recording scan:", error)
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

      {/* Camera Scanner Section */}
      {cameraPermission && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Camera Selection */}
            {availableCameras.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Camera</label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Video Element */}
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              <canvas ref={canvasRef} className="hidden" />

              {!stream && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <CameraOff className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">Camera not initialized</p>
                  </div>
                </div>
              )}

              {isScanning && (
                <div className="absolute inset-0">
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-20">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="w-64 h-40 border-4 border-green-500 bg-green-500/10 rounded-lg">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Scanning...
                  </div>
                </div>
              )}
            </div>

            {/* Scanner Controls */}
            <div className="flex gap-2">
              {!stream ? (
                <Button onClick={initializeCamera} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  Initialize Camera
                </Button>
              ) : !isScanning ? (
                <Button onClick={startScanning} className="flex-1">
                  <Scan className="mr-2 h-4 w-4" />
                  Start Scanning
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
      )}

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
            <label className="text-sm font-medium">Order Number or Barcode</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter order number manually..."
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
                <p className="font-medium">Initialize Camera & Start Scanning</p>
                <p className="text-gray-600">
                  Allow camera access and point your device at barcodes to scan automatically.
                </p>
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
