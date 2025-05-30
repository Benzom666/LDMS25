"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function DriverTasksPage() {
  // Placeholder data for tasks
  const tasks = [
    { id: 1, customer: "John Doe", address: "123 Main St", contact: "555-1234" },
    { id: 2, customer: "Jane Smith", address: "456 Oak Ave", contact: "555-5678" },
  ]

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Task List</h1>
      <div className="space-y-4">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader>
              <CardTitle>Task #{task.id}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>Customer: {task.customer}</p>
              <p>Address: {task.address}</p>
              <p>Contact: {task.contact}</p>
              <Button>Mark as Delivered</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  )
}
