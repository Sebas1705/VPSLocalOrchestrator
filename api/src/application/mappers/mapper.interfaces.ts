/**
 * Mapper Infrastructure
 *
 * Generic interface for bidirectional object mapping.
 * Separates DTO transformations from business logic.
 */

/**
 * Generic Mapper Interface
 * Maps objects from TSource to TDest and vice versa
 */
export interface IMapper<TSource, TDest> {
  /**
   * Map from source to destination
   */
  mapTo(source: TSource): TDest;

  /**
   * Map from destination to source (reverse)
   */
  mapFrom(dest: TDest): TSource;
}

/**
 * Mapper Registry
 * Centralized registry for all mappers
 */
export class MapperRegistry {
  private static mappers = new Map<string, IMapper<any, any>>();

  /**
   * Register a mapper for a type pair
   */
  static register<TSource, TDest>(
    key: string,
    mapper: IMapper<TSource, TDest>
  ): void {
    this.mappers.set(key, mapper);
  }

  /**
   * Get a mapper by key
   */
  static get<TSource, TDest>(key: string): IMapper<TSource, TDest> {
    const mapper = this.mappers.get(key);
    if (!mapper) {
      throw new Error(`Mapper not found for key: ${key}`);
    }
    return mapper;
  }

  /**
   * Clear all mappers (useful for testing)
   */
  static clear(): void {
    this.mappers.clear();
  }

  /**
   * Get mapper count (for debugging)
   */
  static size(): number {
    return this.mappers.size;
  }
}
