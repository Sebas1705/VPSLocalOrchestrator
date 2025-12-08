/**
 * Systemd Service Manager Adapter
 *
 * Uses systemctl to manage system services.
 * All side-effects (process control) isolated here.
 */

import type { IServiceManager, ServiceStatusInfo } from '../ports/os-adapters.js';
import type { ICommandExecutor } from '../ports/os-adapters.js';

export class SystemdServiceManager implements IServiceManager {
  constructor(private readonly commandExecutor: ICommandExecutor) {}

  async startService(name: string): Promise<void> {
    const result = await this.commandExecutor.execute(`systemctl start ${name}`, {});

    if (result.exitCode !== 0) {
      throw new Error(`Failed to start service '${name}': ${result.stderr}`);
    }
  }

  async stopService(name: string): Promise<void> {
    const result = await this.commandExecutor.execute(`systemctl stop ${name}`, {});

    if (result.exitCode !== 0) {
      throw new Error(`Failed to stop service '${name}': ${result.stderr}`);
    }
  }

  async restartService(name: string): Promise<void> {
    const result = await this.commandExecutor.execute(`systemctl restart ${name}`, {});

    if (result.exitCode !== 0) {
      throw new Error(`Failed to restart service '${name}': ${result.stderr}`);
    }
  }

  async getServiceStatus(name: string): Promise<ServiceStatusInfo> {
    try {
      const result = await this.commandExecutor.execute(`systemctl is-active ${name}`, {});
      const enabledResult = await this.commandExecutor.execute(`systemctl is-enabled ${name}`, {});

      const status = (result.stdout.trim() || 'unknown') as 'active' | 'inactive' | 'failed' | 'unknown';
      const enabled = enabledResult.exitCode === 0;

      return {
        name,
        status,
        enabled,
      };
    } catch {
      return {
        name,
        status: 'unknown',
        enabled: false,
      };
    }
  }

  async listServices(): Promise<ServiceStatusInfo[]> {
    try {
      const result = await this.commandExecutor.execute(
        'systemctl list-units --type=service --no-pager --plain | grep -v ^UNIT',
        {}
      );

      if (result.exitCode !== 0) {
        return [];
      }

      const services: ServiceStatusInfo[] = [];

      result.stdout.split('\n').forEach((line) => {
        const parts = line.split(/\s+/);
        if (parts[0]) {
          services.push({
            name: parts[0].replace('.service', ''),
            status: (parts[2] || 'unknown') as 'active' | 'inactive' | 'failed' | 'unknown',
            enabled: false, // would need separate query
          });
        }
      });

      return services;
    } catch {
      return [];
    }
  }
}
