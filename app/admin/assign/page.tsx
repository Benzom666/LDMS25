"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export default function AdminAssignPage() {
  // Placeholder data for deliveries and drivers
  const deliveries = [
    { id: 1, customer: "John Doe", address: "123 Main St" },
    { id: 2, customer: "Jane Smith", address: "456 Oak Ave" },
  ]
  const drivers = [
    { id: 1, name: "John", availability: "Available" },
    { id: 2, name: "Jane", availability: "Busy" },
  ]

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Delivery Assignment</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select Delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a delivery" />
              </SelectTrigger>
              <SelectContent>
                {deliveries.map((delivery) => (
                  <SelectItem key={delivery.id} value={delivery.id.toString()}>
                    {delivery.customer} - {delivery.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Select Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an available driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id.toString()}>
                    {driver.name} ({driver.availability})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
      <Button className="mt-4">Assign Delivery</Button>
    </DashboardLayout>
  )
}
