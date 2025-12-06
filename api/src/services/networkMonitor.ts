import { execSync } from 'child_process';

export interface NetworkInterface {
  name: string;
  ipv4?: string;
  ipv6?: string;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  errors: number;
  dropped: number;
}

export interface NetworkConnections {
  established: number;
  timeWait: number;
  listening: number;
  other: number;
}

export interface NetworkStats {
  interfaces: NetworkInterface[];
  connections: NetworkConnections;
  timestamp: Date;
}

/**
 * Obtiene información de las interfaces de red
 */
async function getNetworkInterfaces(): Promise<NetworkInterface[]> {
  try {
    const output = execSync('ip -s -h link show').toString();
    const lines = output.split('\n');
    const interfaces: NetworkInterface[] = [];
    let currentInterface: Partial<NetworkInterface> | null = null;

    for (const line of lines) {
      // Línea de interfaz: ej: "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536"
      if (/^\d+:/.test(line)) {
        if (currentInterface && currentInterface.name) {
          interfaces.push(currentInterface as NetworkInterface);
        }
        const parts = line.split(':');
        currentInterface = {
          name: (parts[1] ?? '').trim(),
          bytesIn: 0,
          bytesOut: 0,
          packetsIn: 0,
          packetsOut: 0,
          errors: 0,
          dropped: 0,
        };
      }

      // Obtener IPv4
      if (line.includes('inet ') && currentInterface) {
        const match = line.match(/inet\s+([\d.]+)/);
        if (match?.[1]) currentInterface.ipv4 = match[1];
      }

      // Obtener IPv6
      if (line.includes('inet6 ') && currentInterface) {
        const match = line.match(/inet6\s+([a-f0-9:]+)/);
        if (match?.[1] && !match[1].startsWith('fe80')) {
          currentInterface.ipv6 = match[1];
        }
      }

      // Estadísticas de bytes/paquetes (línea con números)
      if (/^\s+RX\s+bytes|^\s+\d+/.test(line) && currentInterface) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 8) {
          currentInterface.bytesIn = parseInt(parts[0] ?? '') || 0;
          currentInterface.packetsIn = parseInt(parts[1] ?? '') || 0;
          currentInterface.errors = parseInt(parts[2] ?? '') || 0;
          currentInterface.dropped = parseInt(parts[3] ?? '') || 0;
          currentInterface.bytesOut = parseInt(parts[4] ?? '') || 0;
          currentInterface.packetsOut = parseInt(parts[5] ?? '') || 0;
        }
      }
    }

    if (currentInterface && currentInterface.name) {
      interfaces.push(currentInterface as NetworkInterface);
    }

    return interfaces;
  } catch (error) {
    console.warn('[networkMonitor] Error al obtener interfaces:', error);
    return [];
  }
}

/**
 * Obtiene información sobre conexiones de red
 */
async function getNetworkConnections(): Promise<NetworkConnections> {
  try {
    const output = execSync('ss -tun 2>/dev/null | grep -E "^tcp|^udp" | awk "{print $2}"').toString();
    const lines = output.split('\n').filter(line => line.trim());

    const connections: NetworkConnections = {
      established: 0,
      timeWait: 0,
      listening: 0,
      other: 0,
    };

    for (const line of lines) {
      if (line.includes('ESTAB')) connections.established++;
      else if (line.includes('TIME-WAIT')) connections.timeWait++;
      else if (line.includes('LISTEN')) connections.listening++;
      else connections.other++;
    }

    return connections;
  } catch (error) {
    console.warn('[networkMonitor] Error al obtener conexiones:', error);
    return { established: 0, timeWait: 0, listening: 0, other: 0 };
  }
}

/**
 * Obtiene estadísticas completas de red
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  const [interfaces, connections] = await Promise.all([
    getNetworkInterfaces(),
    getNetworkConnections(),
  ]);

  return {
    interfaces,
    connections,
    timestamp: new Date(),
  };
}
