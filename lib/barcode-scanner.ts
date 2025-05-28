export interface ScanResult {
  orderNumber: string
  timestamp: string
  location?: {
    latitude: number
    longitude: number
  }
}

class BarcodeScanner {
  private scanner: any = null
  private onScanSuccess: ((result: ScanResult) => void) | null = null
  private onScanError: ((error: string) => void) | null = null
  private locationWatchId: number | null = null

  async getCameraPermissions(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false
      }

      await navigator.mediaDevices.getUserMedia({ video: true })
      return true
    } catch (error) {
      console.error("Camera permission denied:", error)
      return false
    }
  }

  async getAvailableCameras(): Promise<Array<{ id: string; label: string }>> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return []
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          id: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`,
        }))
    } catch (error) {
      console.error("Error getting cameras:", error)
      return []
    }
  }

  async initializeScanner(
    elementId: string,
    onScanSuccess: (result: ScanResult) => void,
    onScanError: (error: string) => void,
  ): Promise<void> {
    try {
      // Dynamically import the HTML5 QR Code Scanner library
      const { Html5Qrcode } = await import("html5-qrcode")

      this.onScanSuccess = onScanSuccess
      this.onScanError = onScanError

      // Create scanner instance
      this.scanner = new Html5Qrcode(elementId)

      // Start watching location
      this.startLocationTracking()

      // Start scanning
      await this.scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        this.handleScanSuccess.bind(this),
        this.handleScanError.bind(this),
      )
    } catch (error) {
      console.error("Error initializing scanner:", error)
      if (this.onScanError) {
        this.onScanError("Failed to initialize scanner")
      }
    }
  }

  async stopScanning(): Promise<void> {
    try {
      if (this.scanner) {
        await this.scanner.stop()
        this.scanner = null
      }

      this.stopLocationTracking()
      this.onScanSuccess = null
      this.onScanError = null
    } catch (error) {
      console.error("Error stopping scanner:", error)
    }
  }

  private startLocationTracking(): void {
    if (navigator.geolocation) {
      this.locationWatchId = navigator.geolocation.watchPosition(
        () => {}, // We'll get the position when needed
        (error) => {
          console.warn("Geolocation error:", error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      )
    }
  }

  private stopLocationTracking(): void {
    if (this.locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.locationWatchId)
      this.locationWatchId = null
    }
  }

  private async getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        () => {
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      )
    })
  }

  private async handleScanSuccess(decodedText: string): Promise<void> {
    if (!this.onScanSuccess) return

    try {
      // Extract order number from barcode
      // Assuming format is either just the order number or has a prefix like "ORDER-"
      const orderNumber = decodedText.includes("-") ? decodedText.split("-")[1] : decodedText

      // Get current location
      const location = await this.getCurrentPosition()

      // Create scan result
      const result: ScanResult = {
        orderNumber,
        timestamp: new Date().toISOString(),
      }

      if (location) {
        result.location = location
      }

      // Call success callback
      this.onScanSuccess(result)
    } catch (error) {
      console.error("Error processing scan:", error)
      if (this.onScanError) {
        this.onScanError("Failed to process scan")
      }
    }
  }

  private handleScanError(errorMessage: string): void {
    if (this.onScanError) {
      this.onScanError(errorMessage)
    }
  }
}

export const barcodeScanner = new BarcodeScanner()
