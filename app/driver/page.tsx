"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DriverDashboard() {
  // Placeholder data for today's deliveries
  const deliveries = [
    { id: 1, customer: "John Doe", status: "Pending" },
    { id: 2, customer: "Jane Smith", status: "In Progress" },
    { id: 3, customer: "David Lee", status: "Delivered" },
  ]

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Today's Deliveries</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deliveries.map((delivery) => (
          <Card key={delivery.id}>
            <CardHeader>
              <CardTitle>Delivery #{delivery.id}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Customer: {delivery.customer}</p>
              <p>Status: {delivery.status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  )
}
