"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { BulkLabelPrinter } from "@/components/bulk-label-printer"

export default function AdminOrderLabelsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Order Labels</h1>
        <p className="text-muted-foreground">Generate and print shipping labels for orders in bulk.</p>

        <BulkLabelPrinter />
      </div>
    </DashboardLayout>
  )
}
