"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminReportingPage() {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Reporting</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>On-Time Delivery %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">95%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Failed Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">5</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Delivery Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">35 mins</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
