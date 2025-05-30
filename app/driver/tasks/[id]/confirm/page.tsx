"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"

export default function DeliveryConfirmationPage() {
  const [photo, setPhoto] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [otp, setOtp] = useState<string | null>(null)

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Delivery Confirmation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Proof of Delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="photo">Photo Upload</Label>
            <Input type="file" id="photo" onChange={(e) => setPhoto(URL.createObjectURL(e.target.files![0]))} />
            {photo && <img src={photo || "/placeholder.svg"} alt="Delivery Proof" className="mt-2 rounded-md" />}
          </div>
          <div>
            <Label htmlFor="signature">Signature</Label>
            <Input
              type="text"
              id="signature"
              placeholder="Enter Signature"
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="otp">OTP</Label>
            <Input type="text" id="otp" placeholder="Enter OTP" onChange={(e) => setOtp(e.target.value)} />
          </div>
          <Button>Confirm Delivery</Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
