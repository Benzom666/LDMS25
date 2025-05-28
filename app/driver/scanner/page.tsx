"use client"

import { useState, useEffect } from "react"
import { BarcodeScannerComponent } from "@/components/barcode-scanner-component"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function ScannerPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Check if browser supports camera
    if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Camera Not Supported",
        description: "Your browser does not support camera access required for scanning.",
        variant: "destructive",
      })
    }

    setLoading(false)
  }, [toast])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Barcode Scanner</h1>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <BarcodeScannerComponent />
      )}
    </div>
  )
}
