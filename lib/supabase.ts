import { getSupabaseClient } from "./supabase-client"

export const supabase = getSupabaseClient()

// Server-side client for API routes
export const createServerSupabaseClient = () => {
  return getSupabaseClient()
}
