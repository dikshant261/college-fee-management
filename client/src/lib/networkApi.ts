import api from './api';

export interface NetworkInterfaceInfo {
  name: string;
  ip: string;
  isWifi: boolean;
}

export interface NetworkInfo {
  hostname: string;
  primaryIp: string;
  serverPort: number;
  clientPort: number;
  serverUrl: string;
  clientUrl: string;
  qrDataUrl: string;
  interfaces: NetworkInterfaceInfo[];
}

export async function fetchNetworkInfo(): Promise<NetworkInfo> {
  const res = await api.get<NetworkInfo>('/api/network-info');
  return res.data;
}
