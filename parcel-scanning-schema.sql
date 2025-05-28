-- Create parcel_scans table for tracking scanned packages
CREATE TABLE IF NOT EXISTS parcel_scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('pickup', 'delivery', 'checkpoint')),
    barcode_data TEXT NOT NULL,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    notes TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parcel_scans_order_id ON parcel_scans(order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_scans_driver_id ON parcel_scans(driver_id);
CREATE INDEX IF NOT EXISTS idx_parcel_scans_scan_type ON parcel_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_parcel_scans_scanned_at ON parcel_scans(scanned_at);

-- Add RLS policies for parcel_scans
ALTER TABLE parcel_scans ENABLE ROW LEVEL SECURITY;

-- Policy: Drivers can only see their own scans
CREATE POLICY "Drivers can view own scans" ON parcel_scans
    FOR SELECT USING (
        auth.uid() = driver_id OR
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Policy: Drivers can insert their own scans
CREATE POLICY "Drivers can insert own scans" ON parcel_scans
    FOR INSERT WITH CHECK (
        auth.uid() = driver_id AND
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'driver'
        )
    );

-- Policy: Drivers can update their own scans
CREATE POLICY "Drivers can update own scans" ON parcel_scans
    FOR UPDATE USING (
        auth.uid() = driver_id AND
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'driver'
        )
    );

-- Policy: Admins can manage all scans
CREATE POLICY "Admins can manage all scans" ON parcel_scans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parcel_scans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_parcel_scans_updated_at
    BEFORE UPDATE ON parcel_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_parcel_scans_updated_at();

-- Add barcode field to orders table if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS barcode TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_barcode ON orders(barcode) WHERE barcode IS NOT NULL;

-- Create view for order scanning information
CREATE OR REPLACE VIEW order_scan_info AS
SELECT 
    o.*,
    ps.scan_type,
    ps.scanned_at,
    ps.location_lat,
    ps.location_lng,
    ps.notes as scan_notes,
    up.first_name || ' ' || up.last_name as scanner_name
FROM orders o
LEFT JOIN parcel_scans ps ON o.id = ps.order_id
LEFT JOIN user_profiles up ON ps.driver_id = up.user_id
ORDER BY ps.scanned_at DESC;

-- Grant permissions
GRANT SELECT ON order_scan_info TO authenticated;
