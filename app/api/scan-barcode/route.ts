import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get request body
    const { barcode, driverId, scanType, location, notes } = await req.json()

    if (!barcode || !driverId) {
      return NextResponse.json({ error: "Barcode and driver ID are required" }, { status: 400 })
    }

    // Look up order by barcode/order number
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .or(`order_number.eq.${barcode},barcode.eq.${barcode},id.eq.${barcode}`)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Check if already scanned by this driver
    const { data: existingScan, error: scanCheckError } = await supabase
      .from("parcel_scans")
      .select("id")
      .eq("order_id", order.id)
      .eq("driver_id", driverId)
      .eq("scan_type", scanType || "delivery")
      .single()

    if (existingScan) {
      return NextResponse.json(
        {
          error: "Order already scanned",
          order,
          alreadyScanned: true,
        },
        { status: 409 },
      )
    }

    // Record the scan
    const scanData = {
      order_id: order.id,
      driver_id: driverId,
      scan_type: scanType || "delivery",
      barcode_data: barcode,
      location_lat: location?.latitude || null,
      location_lng: location?.longitude || null,
      notes: notes || `${scanType || "delivery"} scan`,
    }

    const { data: scan, error: scanError } = await supabase.from("parcel_scans").insert(scanData).select().single()

    if (scanError) {
      console.error("Error recording scan:", scanError)
      return NextResponse.json({ error: "Failed to record scan" }, { status: 500 })
    }

    // Update order status based on scan type
    let newStatus = order.status
    switch (scanType) {
      case "pickup":
        newStatus = "picked_up"
        break
      case "delivery":
        newStatus = "delivered"
        break
      case "checkpoint":
        // Don't change status for checkpoint scans
        break
    }

    if (newStatus !== order.status) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      if (updateError) {
        console.error("Error updating order status:", updateError)
      }

      // Create order update record
      await supabase.from("order_updates").insert({
        order_id: order.id,
        driver_id: driverId,
        status: newStatus,
        notes: `Status updated via ${scanType} scan`,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
      })
    }

    // Log analytics event
    await supabase.from("analytics_events").insert({
      event_type: "barcode_scanned",
      event_data: {
        order_id: order.id,
        driver_id: driverId,
        scan_type: scanType,
        barcode,
        location,
      },
      user_id: driverId,
    })

    return NextResponse.json({
      message: "Barcode scanned successfully",
      order: { ...order, status: newStatus },
      scan,
    })
  } catch (error) {
    console.error("Error processing barcode scan:", error)
    return NextResponse.json({ error: "Unexpected error processing scan" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { searchParams } = new URL(req.url)
    const driverId = searchParams.get("driverId")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    if (!driverId) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 })
    }

    // Get scan history for driver
    const { data: scans, error } = await supabase
      .from("parcel_scans")
      .select(`
        *,
        order:orders(*)
      `)
      .eq("driver_id", driverId)
      .order("scanned_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching scan history:", error)
      return NextResponse.json({ error: "Failed to fetch scan history" }, { status: 500 })
    }

    return NextResponse.json({ scans })
  } catch (error) {
    console.error("Error fetching scan history:", error)
    return NextResponse.json({ error: "Unexpected error fetching scan history" }, { status: 500 })
  }
}
