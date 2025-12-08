/**
 * Dependency Injection Container
 *
 * Simple DI container for managing service lifecycle and configuration.
 * Avoids external library dependencies (tsyringe, awilix) for now.
 * Can be upgraded to tsyringe later if needed.
 *
 * Usage:
 *   const container = new Container();
 *   container.register('logger', () => new Logger());
 *   container.register('executor', (c) => new CommandExecutor(c.get('logger')));
 *   const executor = container.get('executor');
 */

export type ServiceFactory<T> = (container: Container) => T;

export class Container {
  private services = new Map<string, unknown>();
  private factories = new Map<string, ServiceFactory<unknown>>();
  private singletons = new Map<string, boolean>();

  /**
   * Register a service factory.
   * @param key Service identifier
   * @param factory Function that creates the service (receives container for recursive resolution)
   * @param singleton Whether to cache the instance
   */
  register<T>(
    key: string,
    factory: ServiceFactory<T>,
    singleton: boolean = true
  ): void {
    if (this.services.has(key)) {
      throw new Error(`Service '${key}' is already registered`);
    }
    this.factories.set(key, factory);
    this.singletons.set(key, singleton);
  }

  /**
   * Resolve and return a service instance.
   * If singleton, caches and returns same instance on subsequent calls.
   */
  get<T>(key: string): T {
    // Check singleton cache
    if (this.services.has(key)) {
      return this.services.get(key) as T;
    }

    // Check factory
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service '${key}' is not registered`);
    }

    // Create instance
    const instance = factory(this) as T;

    // Cache if singleton
    if (this.singletons.get(key)) {
      this.services.set(key, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered.
   */
  has(key: string): boolean {
    return this.factories.has(key);
  }

  /**
   * Clear all cached singletons (useful for testing).
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Get all registered service keys.
   */
  keys(): string[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Create and configure the application DI container.
 * This is called once at startup.
 */
export function createContainer(): Container {
  const container = new Container();

  // Register repositories (singletons for in-memory storage)
  container.register(
    'commandRepository',
    () => {
      // Dynamic import to avoid circular dependencies
      const { InMemoryCommandRepository } = require('./repositories/index.js') as any;
      return new InMemoryCommandRepository();
    },
    true // singleton
  );

  container.register(
    'resourceRepository',
    () => {
      const { InMemoryResourceRepository } = require('./repositories/index.js') as any;
      return new InMemoryResourceRepository();
    },
    true // singleton
  );

  container.register(
    'serviceRepository',
    () => {
      const { InMemoryServiceRepository } = require('./repositories/index.js') as any;
      return new InMemoryServiceRepository();
    },
    true // singleton
  );

  return container;
}
