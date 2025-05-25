"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { ArrowLeft, Camera, MapPin, Package, CheckCircle, Download, Share } from "lucide-react"

interface OrderUpdate {
  id: string
  order_id: string
  driver_id: string
  status: string
  notes: string
  photo_url?: string
  signature_url?: string
  latitude?: number
  longitude?: number
  delivered_to?: string
  delivery_time: string
  created_at: string
}

export default function PODViewPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [podData, setPodData] = useState<OrderUpdate | null>(null)

  const orderId = params.id as string

  useEffect(() => {
    if (orderId && profile) {
      fetchOrderAndPOD()
    }
  }, [orderId, profile])

  const fetchOrderAndPOD = async () => {
    if (!profile) return

    try {
      setLoading(true)

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("driver_id", profile.user_id)
        .single()

      if (orderError) throw orderError

      // Fetch POD data (order update with delivered status)
      const { data: podData, error: podError } = await supabase
        .from("order_updates")
        .select("*")
        .eq("order_id", orderId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (podError && podError.code !== "PGRST116") {
        // PGRST116 is "not found" error
        throw podError
      }

      setOrder(orderData as Order)
      setPodData(podData as OrderUpdate)
    } catch (error) {
      console.error("Error fetching order and POD data:", error)
      toast({
        title: "Error",
        description: "Failed to load proof of delivery. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadPOD = async () => {
    if (!order || !podData) return

    try {
      // Create a simple POD report
      const podReport = {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        deliveryAddress: order.delivery_address,
        deliveredTo: podData.delivered_to,
        deliveryTime: new Date(podData.delivery_time).toLocaleString(),
        driverNotes: podData.notes,
        location: podData.latitude && podData.longitude ? `${podData.latitude}, ${podData.longitude}` : "Not available",
        photoUrl: podData.photo_url,
        signatureUrl: podData.signature_url,
      }

      const blob = new Blob([JSON.stringify(podReport, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `POD-${order.order_number}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Download Started",
        description: "POD report has been downloaded.",
      })
    } catch (error) {
      console.error("Error downloading POD:", error)
      toast({
        title: "Error",
        description: "Failed to download POD report.",
        variant: "destructive",
      })
    }
  }

  const sharePOD = async () => {
    if (!order) return

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Proof of Delivery - Order #${order.order_number}`,
          text: `Delivery completed for ${order.customer_name} at ${order.delivery_address}`,
          url: window.location.href,
        })
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href)
        toast({
          title: "Link Copied",
          description: "POD link has been copied to clipboard.",
        })
      }
    } catch (error) {
      console.error("Error sharing POD:", error)
      toast({
        title: "Error",
        description: "Failed to share POD.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading proof of delivery...</div>
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Order not found.</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Proof of Delivery</h1>
              <p className="text-muted-foreground">Order #{order.order_number}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadPOD}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" onClick={sharePOD}>
              <Share className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Delivery Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-green-600">
              <CheckCircle className="h-8 w-8" />
              <div className="text-center">
                <h2 className="text-xl font-semibold">Delivery Completed</h2>
                <p className="text-sm text-muted-foreground">
                  {podData?.delivery_time ? new Date(podData.delivery_time).toLocaleString() : "Time not recorded"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="font-medium">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Order Number</p>
                  <p className="font-medium">#{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Priority</p>
                  <Badge variant={order.priority === "urgent" ? "destructive" : "outline"}>{order.priority}</Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivery Address</p>
                  <p className="font-medium">{order.delivery_address}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Order Created</p>
                  <p className="font-medium">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                {order.delivery_notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Special Instructions</p>
                    <p className="font-medium">{order.delivery_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* POD Evidence */}
        {podData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Proof of Delivery Evidence
              </CardTitle>
              <CardDescription>Documentation provided at the time of delivery</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Delivery Confirmation */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivered To</p>
                  <p className="font-medium">{podData.delivered_to || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivery Time</p>
                  <p className="font-medium">{new Date(podData.delivery_time).toLocaleString()}</p>
                </div>
              </div>

              {/* Photo Evidence */}
              {podData.photo_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Photo Evidence</p>
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={podData.photo_url || "/placeholder.svg"}
                      alt="Delivery proof photo"
                      className="w-full max-h-64 object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Signature Evidence */}
              {podData.signature_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Digital Signature</p>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <img
                      src={podData.signature_url || "/placeholder.svg"}
                      alt="Customer signature"
                      className="w-full max-h-32 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Delivery Notes */}
              {podData.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Delivery Notes</p>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{podData.notes}</p>
                  </div>
                </div>
              )}

              {/* Location Data */}
              {podData.latitude && podData.longitude && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Delivery Location</p>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">GPS Coordinates Captured</p>
                      <p className="text-xs text-green-600">
                        {podData.latitude.toFixed(6)}, {podData.longitude.toFixed(6)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`https://www.google.com/maps?q=${podData.latitude},${podData.longitude}`, "_blank")
                      }
                    >
                      View on Map
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No POD Data */}
        {!podData && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Camera className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Proof of Delivery Found</h3>
                <p className="text-muted-foreground">
                  This order shows as delivered but no proof of delivery documentation was found.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
