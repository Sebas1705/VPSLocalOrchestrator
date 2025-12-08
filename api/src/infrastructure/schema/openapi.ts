/**
 * OpenAPI Schema Generation
 * 
 * Generates OpenAPI 3.1.0 specification for API endpoints
 * Serves as single source of truth for API contract
 * Enables generated clients and contract testing
 * 
 * @module infrastructure/schema/openapi
 */

import { getLogger } from '../../config/index.js';

const logger = getLogger('openapi');

/**
 * OpenAPI parameter
 */
export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema: {
    type: string;
    description?: string;
  };
  description?: string;
}

/**
 * OpenAPI request body
 */
export interface OpenAPIRequestBody {
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: Record<string, any>;
    };
  };
  description?: string;
}

/**
 * OpenAPI response
 */
export interface OpenAPIResponse {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: Record<string, any>;
    };
  };
}

/**
 * OpenAPI operation
 */
export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

/**
 * OpenAPI path item
 */
export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  head?: OpenAPIOperation;
  options?: OpenAPIOperation;
  trace?: OpenAPIOperation;
}

/**
 * OpenAPI specification
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<
      string,
      {
        enum?: string[];
        default: string;
      }
    >;
  }>;
  paths: Record<string, OpenAPIPathItem>;
  components: {
    schemas?: Record<string, Record<string, any>>;
    securitySchemes?: Record<string, Record<string, any>>;
    responses?: Record<string, OpenAPIResponse>;
    parameters?: Record<string, OpenAPIParameter>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

/**
 * OpenAPI Schema Builder
 */
export class OpenAPIBuilder {
  private spec: OpenAPISpec;

  constructor(
    title: string,
    version: string,
    description?: string
  ) {
    this.spec = {
      openapi: '3.1.0',
      info: {
        title,
        version,
        ...(description && { description }),
        license: {
          name: 'Proprietary',
        },
      },
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'token',
            description: 'API token authentication',
          },
        },
      },
      security: [
        {
          BearerAuth: [],
        },
      ],
      tags: [],
    };

    logger.info('OpenAPI builder initialized', { title, version });
  }

  /**
   * Add server
   */
  addServer(url: string, description: string): this {
    if (!this.spec.servers) {
      this.spec.servers = [];
    }

    this.spec.servers.push({
      url,
      description,
    });

    return this;
  }

  /**
   * Add schema component
   */
  addSchema(name: string, schema: Record<string, any>): this {
    if (!this.spec.components.schemas) {
      this.spec.components.schemas = {};
    }

    this.spec.components.schemas[name] = schema;
    return this;
  }

  /**
   * Add path
   */
  addPath(path: string, method: string, operation: OpenAPIOperation): this {
    if (!this.spec.paths[path]) {
      this.spec.paths[path] = {};
    }

    const pathItem = this.spec.paths[path] as Record<string, OpenAPIOperation>;
    pathItem[method.toLowerCase()] = operation;

    return this;
  }

  /**
   * Add tag
   */
  addTag(name: string, description?: string): this {
    if (!this.spec.tags) {
      this.spec.tags = [];
    }

    this.spec.tags.push({
      name,
      ...(description && { description }),
    });

    return this;
  }

  /**
   * Get specification
   */
  getSpec(): OpenAPISpec {
    return this.spec;
  }

  /**
   * Get JSON
   */
  toJSON(): string {
    return JSON.stringify(this.spec, null, 2);
  }

  /**
   * Get YAML
   */
  toYAML(): string {
    // Simple YAML conversion (would use yaml library in production)
    const json = this.spec;
    let yaml = 'openapi: ' + json.openapi + '\n';
    yaml += 'info:\n';
    yaml += `  title: ${json.info.title}\n`;
    yaml += `  version: ${json.info.version}\n`;

    if (json.info.description) {
      yaml += `  description: ${json.info.description}\n`;
    }

    yaml += 'paths:\n';
    for (const [path, pathItem] of Object.entries(json.paths)) {
      yaml += `  ${path}:\n`;
      for (const [method, operation] of Object.entries(
        pathItem as Record<string, OpenAPIOperation>
      )) {
        if (operation) {
          yaml += `    ${method}:\n`;
          if ((operation as any).summary) {
            yaml += `      summary: ${(operation as any).summary}\n`;
          }
          if ((operation as any).description) {
            yaml += `      description: ${(operation as any).description}\n`;
          }
        }
      }
    }

    return yaml;
  }
}

/**
 * Default API schemas
 */
export const StandardSchemas = {
  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'string',
        description: 'Error message',
      },
      details: {
        type: 'object',
        description: 'Additional error details',
      },
    },
  },
  RateLimitResult: {
    type: 'object',
    required: ['allowed', 'remaining', 'resetAt'],
    properties: {
      allowed: {
        type: 'boolean',
        description: 'Whether request is allowed',
      },
      remaining: {
        type: 'integer',
        description: 'Remaining requests in current window',
      },
      resetAt: {
        type: 'integer',
        description: 'Unix timestamp when limit resets',
      },
      retryAfter: {
        type: 'integer',
        description: 'Seconds to wait before retrying',
      },
    },
  },
  HealthStatus: {
    type: 'object',
    required: ['status', 'timestamp'],
    properties: {
      status: {
        type: 'string',
        enum: ['healthy', 'unhealthy', 'degraded'],
        description: 'Health status',
      },
      timestamp: {
        type: 'integer',
        description: 'Check timestamp',
      },
      checks: {
        type: 'object',
        description: 'Individual component checks',
      },
    },
  },
  Job: {
    type: 'object',
    required: ['id', 'type', 'status'],
    properties: {
      id: {
        type: 'string',
        description: 'Job ID',
      },
      type: {
        type: 'string',
        description: 'Job type',
      },
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
        description: 'Job status',
      },
      createdAt: {
        type: 'integer',
        description: 'Creation timestamp',
      },
      completedAt: {
        type: 'integer',
        description: 'Completion timestamp',
      },
      result: {
        type: 'object',
        description: 'Job result',
      },
    },
  },
};

/**
 * Global OpenAPI builder instance
 */
let globalBuilder: OpenAPIBuilder | null = null;

/**
 * Initialize OpenAPI builder
 */
export function initializeOpenAPI(
  title: string = 'VPS Local Orchestrator API',
  version: string = '6.1.0'
): OpenAPIBuilder {
  if (!globalBuilder) {
    globalBuilder = new OpenAPIBuilder(
      title,
      version,
      'Comprehensive API for managing VPS resources and executing commands'
    );

    // Add standard schemas
    for (const [name, schema] of Object.entries(StandardSchemas)) {
      globalBuilder.addSchema(name, schema);
    }

    // Add servers
    globalBuilder.addServer('http://localhost:3000', 'Development server');

    logger.info('OpenAPI builder initialized');
  }

  return globalBuilder;
}

/**
 * Get OpenAPI builder
 */
export function getOpenAPIBuilder(): OpenAPIBuilder {
  if (!globalBuilder) {
    return initializeOpenAPI();
  }
  return globalBuilder;
}
