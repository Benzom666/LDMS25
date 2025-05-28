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

    const { orderId } = await request.json()

    // Validate required fields
    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 })
    }

    // Get user from session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the latest label for this order
    const { data: labelData, error: labelError } = await supabase
      .from("order_labels")
      .select("*")
      .eq("order_id", orderId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single()

    if (labelError || !labelData) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 })
    }

    // Update print count
    const { error: updateError } = await supabase
      .from("order_labels")
      .update({
        print_count: (labelData.print_count || 0) + 1,
        last_printed_at: new Date().toISOString(),
      })
      .eq("id", labelData.id)

    if (updateError) {
      console.error("Error updating print count:", updateError)
      return NextResponse.json({ error: "Failed to update print count" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Print count updated" })
  } catch (error) {
    console.error("Error in print API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
