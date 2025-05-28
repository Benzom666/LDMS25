/**
 * Label Generator Library
 * Handles PDF generation with barcode support for shipping labels
 */

import { jsPDF } from "jspdf"
import JsBarcode from "jsbarcode"

export interface LabelData {
  orderNumber: string
  customerName: string
  customerPhone?: string
  deliveryAddress: string
  pickupAddress: string
  priority: string
  weight?: string
  dimensions?: string
  specialInstructions?: string
  createdDate: string
  driverName?: string
}

export class LabelGenerator {
  /**
   * Generates a PDF shipping label with barcode for a single order
   */
  static async generateLabel(data: LabelData): Promise<Blob> {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a6",
    })

    // Set background color
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, 105, 148, "F")

    // Add header
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, 105, 15, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("DELIVERY SYSTEM", 52.5, 8, { align: "center" })

    // Add order number and priority
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.text(`ORDER: ${data.orderNumber || "N/A"}`, 5, 22)

    // Add priority indicator
    const priority = data.priority || "normal"
    const priorityColor = priority === "urgent" ? "#ff0000" : priority === "high" ? "#ff9900" : "#009900"
    doc.setFillColor(priorityColor)
    doc.rect(80, 18, 20, 8, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.text(priority.toUpperCase(), 90, 23, { align: "center" })

    // Add barcode
    try {
      const barcodeDataUrl = await this.generateBarcodeDataUrl(data.orderNumber || "UNKNOWN")
      doc.addImage(barcodeDataUrl, "PNG", 15, 28, 75, 20)
    } catch (error) {
      console.error("Failed to generate barcode:", error)
      // Fallback text if barcode generation fails
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.text(`Barcode: ${data.orderNumber || "N/A"}`, 52.5, 38, { align: "center" })
    }

    // Add delivery information
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("DELIVER TO:", 5, 55)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(data.customerName || "Unknown Customer", 5, 60)
    if (data.customerPhone) {
      doc.text(`Tel: ${data.customerPhone}`, 5, 65)
      doc.text(this.formatAddress(data.deliveryAddress), 5, 70, {
        maxWidth: 95,
      })
    } else {
      doc.text(this.formatAddress(data.deliveryAddress), 5, 65, {
        maxWidth: 95,
      })
    }

    // Add pickup information
    const pickupY = data.customerPhone ? 85 : 80
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("PICKUP FROM:", 5, pickupY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text(this.formatAddress(data.pickupAddress), 5, pickupY + 5, {
      maxWidth: 95,
    })

    // Add package details
    const detailsY = pickupY + 20
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("PACKAGE DETAILS:", 5, detailsY)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)

    let currentY = detailsY + 5
    if (data.weight) {
      doc.text(`Weight: ${data.weight}`, 5, currentY)
      currentY += 4
    }
    if (data.dimensions) {
      doc.text(`Dimensions: ${data.dimensions}`, 5, currentY)
      currentY += 4
    }

    // Add special instructions if any
    if (data.specialInstructions) {
      doc.setFont("helvetica", "bold")
      doc.text("SPECIAL INSTRUCTIONS:", 5, currentY + 2)
      doc.setFont("helvetica", "normal")
      doc.text(data.specialInstructions, 5, currentY + 7, {
        maxWidth: 95,
      })
    }

    // Add footer
    doc.setFontSize(8)
    doc.text(`Created: ${data.createdDate || new Date().toLocaleDateString()}`, 5, 143)
    if (data.driverName) {
      doc.text(`Driver: ${data.driverName}`, 70, 143)
    }

    return doc.output("blob")
  }

  /**
   * Generates multiple labels in a single PDF document
   */
  static async generateBatchLabels(dataArray: LabelData[]): Promise<Blob> {
    if (!dataArray.length) {
      throw new Error("No label data provided")
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a6",
    })

    for (let i = 0; i < dataArray.length; i++) {
      if (i > 0) {
        doc.addPage("a6", "portrait")
      }

      // Generate the label on the current page
      const labelDoc = await this.generateLabel(dataArray[i])
      const labelData = await this.blobToBase64(labelDoc)
      doc.addImage(labelData, "PNG", 0, 0, 105, 148)
    }

    return doc.output("blob")
  }

  /**
   * Downloads the generated label PDF
   */
  static downloadLabel(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Prints the label directly to the printer
   */
  static async printLabel(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement("iframe")
    iframe.style.display = "none"
    iframe.src = url

    return new Promise((resolve) => {
      iframe.onload = () => {
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(url)
          resolve()
        }, 1000)
      }
      document.body.appendChild(iframe)
    })
  }

  /**
   * Helper method to generate a barcode as a data URL
   * Uses JsBarcode library to generate a proper scannable barcode
   */
  private static async generateBarcodeDataUrl(data: string): Promise<string> {
    // Create a canvas element for the barcode
    const canvas = document.createElement("canvas")

    try {
      // Use JsBarcode to generate a Code128 barcode (widely supported format)
      JsBarcode(canvas, data, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        textMargin: 2,
        height: 50,
        margin: 10,
        background: "#FFFFFF",
      })

      // Return the canvas as a data URL
      return canvas.toDataURL("image/png")
    } catch (error) {
      console.error("Error generating barcode:", error)

      // Fallback to a simple text representation if JsBarcode fails
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Could not get canvas context")

      canvas.width = 300
      canvas.height = 80

      // Draw white background
      ctx.fillStyle = "#FFFFFF"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw text
      ctx.font = "16px Arial"
      ctx.fillStyle = "#000000"
      ctx.textAlign = "center"
      ctx.fillText(data, canvas.width / 2, 40)

      return canvas.toDataURL("image/png")
    }
  }

  /**
   * Helper method to format address text
   */
  private static formatAddress(address: string | undefined | null): string {
    if (!address) {
      return "Address not provided"
    }
    return address.replace(/,\s*/g, ",\n")
  }

  /**
   * Helper method to convert a blob to base64
   */
  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
}
