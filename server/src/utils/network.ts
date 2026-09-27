import os from 'os';
import path from 'path';
import fs from 'fs';
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
  serverQrDataUrl?: string;
  clientQrDataUrl?: string;
  interfaces: NetworkInterfaceInfo[];
}

/**
 * Checks whether the compiled static React frontend dist folder is present.
 */
export function isStaticClientAvailable(): boolean {
  const clientDistCandidates = [
    process.env.CLIENT_DIST_DIR,
    path.join(process.cwd(), 'client/dist'),
    path.join(process.cwd(), '../client/dist'),
    path.join(__dirname, '../../client/dist'),
    path.join(__dirname, '../client/dist')
  ].filter(Boolean) as string[];

  return clientDistCandidates.some(
    (distPath) => fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'))
  );
}

/**
 * Returns all active, non-internal, physical IPv4 network interfaces on the host machine.
 * Filters out virtual network adapters (WSL, VirtualBox, VMware, Docker, Hyper-V, APIPA).
 */
export function getAllNetworkIps(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: NetworkInterfaceInfo[] = [];

  const virtualKeywords = [
    'vethernet',
    'virtualbox',
    'vmware',
    'hyper-v',
    'loopback',
    'teredo',
    'pseudo',
    'bluetooth',
    'wsl',
    'docker'
  ];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const lowerName = name.toLowerCase();
    const isVirtual = virtualKeywords.some((keyword) => lowerName.includes(keyword));
    if (isVirtual) continue;

    for (const addr of addrs) {
      const isIpv4 = addr.family === 'IPv4' || (addr as any).family === 4;
      if (isIpv4 && !addr.internal) {
        // Exclude link-local auto-assigned IPs (169.254.x.x)
        if (addr.address.startsWith('169.254.')) continue;

        const isWifi =
          lowerName.includes('wi-fi') ||
          lowerName.includes('wifi') ||
          lowerName.includes('wlan') ||
          lowerName.includes('wireless');

        results.push({
          name,
          ip: addr.address,
          isWifi
        });
      }
    }
  }

  // Fallback to any non-internal IPv4 if everything was filtered out
  if (results.length === 0) {
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        const isIpv4 = addr.family === 'IPv4' || (addr as any).family === 4;
        if (isIpv4 && !addr.internal && !addr.address.startsWith('169.254.')) {
          results.push({
            name,
            ip: addr.address,
            isWifi: false
          });
        }
      }
    }
  }

  // Prioritize physical Wi-Fi interfaces, then private LAN subnets (192.168.x.x, 10.x.x.x)
  results.sort((a, b) => {
    if (a.isWifi && !b.isWifi) return -1;
    if (!a.isWifi && b.isWifi) return 1;
    const isPrivateA = a.ip.startsWith('192.168.') || a.ip.startsWith('10.');
    const isPrivateB = b.ip.startsWith('192.168.') || b.ip.startsWith('10.');
    if (isPrivateA && !isPrivateB) return -1;
    if (!isPrivateA && isPrivateB) return 1;
    return 0;
  });

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
 * In production / standalone mode, automatically aligns clientPort to serverPort (5000).
 */
export async function getNetworkDetails(serverPort = 5000, clientPortOverride?: number): Promise<NetworkInfo> {
  const primaryIp = getPrimaryNetworkIp();
  const interfaces = getAllNetworkIps();
  const staticAvailable = isStaticClientAvailable();

  // If running in production or serving compiled static React files, client is on serverPort (5000)
  const clientPort =
    staticAvailable || process.env.NODE_ENV === 'production'
      ? serverPort
      : (clientPortOverride || Number(process.env.CLIENT_PORT || 5173));

  const serverUrl = `http://${primaryIp}:${serverPort}`;
  const clientUrl = `http://${primaryIp}:${clientPort}`;

  let serverQrDataUrl = '';
  let clientQrDataUrl = '';

  try {
    serverQrDataUrl = await QRCode.toDataURL(serverUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });

    if (clientPort !== serverPort) {
      clientQrDataUrl = await QRCode.toDataURL(clientUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff'
        }
      });
    } else {
      clientQrDataUrl = serverQrDataUrl;
    }
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
    qrDataUrl: serverQrDataUrl || clientQrDataUrl,
    serverQrDataUrl,
    clientQrDataUrl,
    interfaces
  };
}
