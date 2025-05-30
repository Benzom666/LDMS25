"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDashboard() {
  // Placeholder data for real-time driver locations and delivery statuses
  const drivers = [
    { id: 1, name: "John", location: "123 Main St", status: "In Transit" },
    { id: 2, name: "Jane", location: "456 Oak Ave", status: "Delivered" },
  ]

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {drivers.map((driver) => (
          <Card key={driver.id}>
            <CardHeader>
              <CardTitle>Driver: {driver.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Location: {driver.location}</p>
              <p>Status: {driver.status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  )
}
