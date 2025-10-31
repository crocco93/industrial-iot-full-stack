export type ProtocolType = 
  | 'modbus-tcp' 
  | 'opc-ua' 
  | 'mqtt' 
  | 'ethernet-ip' 
  | 'profinet' 
  | 'canopen' 
  | 'bacnet';

export interface ProtocolConfiguration {
  [key: string]: any;
}

export interface ConnectionStatus {
  connected: boolean;
  last_seen: string;
  error_count: number;
  latency_ms: number;
}

export interface ModbusConfig {
  host: string;
  port: number;
  unit_id: number;
  timeout?: number;
}

export interface OpcUaConfig {
  endpoint: string;
  security_mode: 'None' | 'Sign' | 'SignAndEncrypt';
  security_policy: string;
  username?: string;
  password?: string;
}

export interface MqttConfig {
  host: string;
  port: number;
  topic: string;
  qos: 0 | 1 | 2;
  username?: string;
  password?: string;
  keep_alive?: number;
}

export interface EthernetIpConfig {
  host: string;
  port: number;
  slot: number;
  plc_type: 'logix' | 'slc' | 'micrologix' | 'plc5';
}

export interface ProfinetConfig {
  host: string;
  port: number;
  rack: number;
  slot: number;
  connection_type: 'pg' | 'op' | 'basic';
}

export interface CanopenConfig {
  interface: string;
  baud_rate: number;
  node_id: number;
  heartbeat?: number;
}

export interface BacnetConfig {
  device_id: number;
  address: string;
  port: number;
  max_apdu_length?: number;
}