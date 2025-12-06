import { executeCommand } from './commandExecutor.js';

export interface ServiceHealth {
  name: string;
  active: boolean;
  enabled: boolean;
  status: string;
  uptime?: string;
  memoryUsage?: string;
  cpuUsage?: string;
}

/**
 * Obtiene el estado de salud de un servicio systemd
 */
export async function getServiceHealth(serviceName: string): Promise<ServiceHealth> {
  try {
    // Validar nombre del servicio (evitar inyección)
    if (!/^[a-zA-Z0-9._\-]+$/.test(serviceName)) {
      return {
        name: serviceName,
        active: false,
        enabled: false,
        status: 'Invalid service name',
      };
    }

    // Ejecutar systemctl status
    const cmdResult = await executeCommand(`systemctl status ${serviceName}`, { timeout: 10000 });
    
    // Parsear salida
    const output = cmdResult.stdout;
    const active = /Active: active/.test(output);
    const enabled = /Enabled: enabled|preset: enabled/.test(output);
    
    // Extraer línea de estado
    const statusMatch = output.match(/Active: \w+ \(([^)]+)\)/);
    const status = statusMatch?.[1] ?? 'unknown';

    // Extraer uptime si está disponible
    const uptimeMatch = output.match(/Active: \w+ \([^)]+\) for ([^;]+)/);
    const uptime = uptimeMatch?.[1];

    // Extraer memoria y CPU si están disponibles
    const memoryMatch = output.match(/Memory: ([\d.]+M)/);
    const cpuMatch = output.match(/CPU: ([\d.]+ms)/);
    const memoryUsage = memoryMatch?.[1];
    const cpuUsage = cpuMatch?.[1];

    const result: ServiceHealth = {
      name: serviceName,
      active,
      enabled,
      status,
    };

    if (uptime) result.uptime = uptime;
    if (memoryUsage) result.memoryUsage = memoryUsage;
    if (cpuUsage) result.cpuUsage = cpuUsage;

    return result;
  } catch (error: any) {
    return {
      name: serviceName,
      active: false,
      enabled: false,
      status: error.message || 'Error checking service status',
    };
  }
}

/**
 * Obtiene el estado de múltiples servicios
 */
export async function getMultipleServicesHealth(serviceNames: string[]): Promise<ServiceHealth[]> {
  const results = await Promise.all(
    serviceNames.map(name => getServiceHealth(name))
  );
  return results;
}

/**
 * Lista servicios activos del sistema
 */
export async function listActiveServices(): Promise<{ name: string; status: string }[]> {
  try {
    const result = await executeCommand('systemctl list-units --type=service --state=active --no-pager -q');
    const lines = result.stdout.split('\n').filter(line => line.trim());
    
    const services: { name: string; status: string }[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const name = (parts[0] ?? '').replace('.service', '');
        services.push({
          name,
          status: 'active',
        });
      }
    }
    
    return services;
  } catch (error) {
    return [];
  }
}
