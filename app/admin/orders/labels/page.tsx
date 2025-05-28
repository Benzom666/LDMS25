"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LabelGeneratorComponent } from "@/components/label-generator-component"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase-client"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function OrderLabelsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_email,
          delivery_address,
          pickup_address,
          priority,
          delivery_notes,
          created_at,
          status,
          driver_id
        `)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      // Get driver names for assigned orders
      const ordersWithDrivers = await Promise.all(
        data.map(async (order) => {
          if (order.driver_id) {
            const { data: driverData } = await supabase
              .from("user_profiles")
              .select("first_name, last_name")
              .eq("user_id", order.driver_id)
              .single()

            if (driverData) {
              return {
                ...order,
                driver_name: `${driverData.first_name} ${driverData.last_name}`.trim(),
              }
            }
          }
          return order
        }),
      )

      setOrders(ordersWithDrivers)
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

  const handleLabelGenerated = async (orderId: string, labelUrl: string) => {
    // In a real app, you might want to update the UI or refresh the data
    console.log(`Label generated for order ${orderId}: ${labelUrl}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Order Labels</h1>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <LabelGeneratorComponent orders={orders} onLabelGenerated={handleLabelGenerated} />
      )}
    </div>
  )
}
