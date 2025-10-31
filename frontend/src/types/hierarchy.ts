export interface Location {
  id: string;
  name: string;
  description?: string;
  address?: string;
  devices: Device[];
  areas: Area[];
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  name: string;
  description?: string;
  location_id: string;
  devices: Device[];
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  name: string;
  type: 'infrastructure' | 'production';
  protocol_type: string;
  location_id?: string;
  area_id?: string;
  configuration: any;
  data_points: DataPoint[];
  status: 'connected' | 'disconnected' | 'error';
  created_at: string;
  updated_at: string;
}

export interface DataPoint {
  id: string;
  name: string;
  address: string;
  data_type: string;
  unit: string;
  scaling: {
    multiplier: number;
    offset: number;
  };
  current_value: number;
  quality: 'Good' | 'Bad' | 'Uncertain';
  device_id: string;
}