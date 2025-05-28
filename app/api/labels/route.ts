import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options })
        },
      },
    })

    const { orderId, barcodeData, labelType, labelData } = await request.json()

    // Validate required fields
    if (!orderId || !barcodeData || !labelData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get user from session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Store label in database
    const { data, error } = await supabase.from("order_labels").insert({
      order_id: orderId,
      label_url: `label_${orderId}.pdf`, // In a real app, this would be a URL to cloud storage
      barcode_data: barcodeData,
      generated_by: session.user.id,
      label_type: labelType || "standard",
    })

    if (error) {
      console.error("Error saving label:", error)
      return NextResponse.json({ error: "Failed to save label" }, { status: 500 })
    }

    // In a real app, you would upload the PDF to cloud storage here
    // For this example, we'll just return success

    return NextResponse.json({ success: true, message: "Label saved successfully" })
  } catch (error) {
    console.error("Error in label API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const orderId = url.searchParams.get("orderId")

    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options })
        },
      },
    })

    // Get user from session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let query = supabase.from("order_labels").select("*")

    if (orderId) {
      query = query.eq("order_id", orderId)
    }

    const { data, error } = await query.order("generated_at", { ascending: false })

    if (error) {
      console.error("Error fetching labels:", error)
      return NextResponse.json({ error: "Failed to fetch labels" }, { status: 500 })
    }

    return NextResponse.json({ labels: data })
  } catch (error) {
    console.error("Error in label API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
