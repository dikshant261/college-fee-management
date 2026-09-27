import os from 'os';
// @ts-ignore
import QRCode from 'qrcode';

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

/**
 * Returns all active, non-internal IPv4 network interfaces on the host machine.
 */
export function getAllNetworkIps(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: NetworkInterfaceInfo[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      // Node 18+ uses family as 'IPv4' (string) or 4 (number)
      const isIpv4 = addr.family === 'IPv4' || (addr as any).family === 4;
      if (isIpv4 && !addr.internal) {
        const lowerName = name.toLowerCase();
        const isWifi = lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan') || lowerName.includes('wireless');
        results.push({
          name,
          ip: addr.address,
          isWifi
        });
      }
    }
  }

  // Sort so Wi-Fi / WLAN interfaces come first, then Ethernet
  results.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
  return results;
}

/**
 * Returns the primary IPv4 address for local network access (e.g. 192.168.1.15).
 * Falls back to '127.0.0.1' if no network interfaces are found.
 */
export function getPrimaryNetworkIp(): string {
  const ips = getAllNetworkIps();
  return ips.length > 0 ? ips[0].ip : '127.0.0.1';
}

/**
 * Generates comprehensive network info including a QR Code for instant mobile access.
 */
export async function getNetworkDetails(serverPort = 5000, clientPort = 5173): Promise<NetworkInfo> {
  const primaryIp = getPrimaryNetworkIp();
  const interfaces = getAllNetworkIps();
  const serverUrl = `http://${primaryIp}:${serverPort}`;
  const clientUrl = `http://${primaryIp}:${clientPort}`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(clientUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Failed to generate network QR code', err);
  }

  return {
    hostname: os.hostname(),
    primaryIp,
    serverPort,
    clientPort,
    serverUrl,
    clientUrl,
    qrDataUrl,
    interfaces
  };
}
