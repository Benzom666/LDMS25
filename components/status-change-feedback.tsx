"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react"

interface StatusChangeFeedbackProps {
  oldStatus: string
  newStatus: string
  isProcessing?: boolean
  onComplete?: () => void
}

export function StatusChangeFeedback({
  oldStatus,
  newStatus,
  isProcessing = false,
  onComplete,
}: StatusChangeFeedbackProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (isProcessing) {
      const timer = setTimeout(() => {
        setStep(1)
        setTimeout(() => {
          setStep(2)
          setTimeout(() => {
            onComplete?.()
          }, 1000)
        }, 1500)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [isProcessing, onComplete])

  const getStatusBadge = (status: string, variant: "old" | "new") => {
    const isDelivered = status === "delivered"
    const baseClasses = variant === "old" ? "opacity-60" : ""

    return (
      <Badge
        variant="outline"
        className={`${
          isDelivered ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        } ${baseClasses}`}
      >
        {isDelivered ? <CheckCircle className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
        {isDelivered ? "Delivered" : "Undelivered"}
      </Badge>
    )
  }

  if (!isProcessing) return null

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-center space-x-4">
          {/* Old Status */}
          <div className="text-center">
            {getStatusBadge(oldStatus, "old")}
            <p className="text-xs text-muted-foreground mt-1">Previous</p>
          </div>

          {/* Arrow/Progress */}
          <div className="flex items-center space-x-2">
            {step === 0 && <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />}
            {step === 1 && <Clock className="h-5 w-5 text-blue-600" />}
            {step === 2 && <CheckCircle className="h-5 w-5 text-green-600" />}
          </div>

          {/* New Status */}
          <div className="text-center">
            {getStatusBadge(newStatus, "new")}
            <p className="text-xs text-muted-foreground mt-1">
              {step === 0 && "Processing..."}
              {step === 1 && "Updating..."}
              {step === 2 && "Complete!"}
            </p>
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-sm text-blue-700">
            {step === 0 && "Updating order status..."}
            {step === 1 && "Recording changes..."}
            {step === 2 && "Status change completed successfully!"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
