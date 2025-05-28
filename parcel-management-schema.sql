-- Create parcel_scans table for tracking barcode scans
CREATE TABLE IF NOT EXISTS parcel_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN ('pickup', 'delivery', 'checkpoint', 'return', 'damage_report')),
  barcode_data TEXT NOT NULL,
  scan_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  notes TEXT,
  photo_urls TEXT[], -- Array of photo URLs
  metadata JSONB DEFAULT '{}', -- Additional scan data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parcel_status_history table for detailed tracking
CREATE TABLE IF NOT EXISTS parcel_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  scan_id UUID REFERENCES parcel_scans(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL,
  location TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  automatic BOOLEAN DEFAULT FALSE, -- Whether this was automatically generated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create parcel_labels table for tracking generated labels
CREATE TABLE IF NOT EXISTS parcel_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  label_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  barcode_data TEXT NOT NULL,
  label_url TEXT, -- URL to stored PDF
  generated_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_at TIMESTAMP WITH TIME ZONE,
  print_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parcel_scans_order_id ON parcel_scans(order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_scans_driver_id ON parcel_scans(driver_id);
CREATE INDEX IF NOT EXISTS idx_parcel_scans_timestamp ON parcel_scans(scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_parcel_scans_type ON parcel_scans(scan_type);

CREATE INDEX IF NOT EXISTS idx_parcel_status_history_order_id ON parcel_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_status_history_timestamp ON parcel_status_history(timestamp);

CREATE INDEX IF NOT EXISTS idx_parcel_labels_order_id ON parcel_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_parcel_labels_barcode ON parcel_labels(barcode_data);

-- Add RLS policies
ALTER TABLE parcel_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_labels ENABLE ROW LEVEL SECURITY;

-- Policies for parcel_scans
CREATE POLICY "Users can view their own parcel scans" ON parcel_scans
  FOR SELECT USING (
    driver_id = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );

CREATE POLICY "Drivers can insert their own parcel scans" ON parcel_scans
  FOR INSERT WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Users can update their own parcel scans" ON parcel_scans
  FOR UPDATE USING (
    driver_id = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );

-- Policies for parcel_status_history
CREATE POLICY "Users can view parcel status history" ON parcel_status_history
  FOR SELECT USING (
    driver_id = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can insert parcel status history" ON parcel_status_history
  FOR INSERT WITH CHECK (
    driver_id = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );

-- Policies for parcel_labels
CREATE POLICY "Users can view their parcel labels" ON parcel_labels
  FOR SELECT USING (
    generated_by = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can insert parcel labels" ON parcel_labels
  FOR INSERT WITH CHECK (
    generated_by = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can update their parcel labels" ON parcel_labels
  FOR UPDATE USING (
    generated_by = auth.uid() OR 
    order_id IN (SELECT id FROM orders WHERE created_by = auth.uid())
  );
