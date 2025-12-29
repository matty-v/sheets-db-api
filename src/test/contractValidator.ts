import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { parse } from 'yaml';
import OpenAPIResponseValidator from 'openapi-response-validator';

function findProjectRoot(): string {
  return resolve(process.cwd());
}

interface OpenAPISpec {
  paths: Record<string, Record<string, PathOperation>>;
  components: {
    schemas: Record<string, SchemaObject>;
    parameters: Record<string, ParameterObject>;
  };
}

interface PathOperation {
  operationId: string;
  responses: Record<string, ResponseObject>;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
}

interface ResponseObject {
  description: string;
  content?: Record<string, { schema: SchemaObject }>;
}

interface RequestBodyObject {
  required?: boolean;
  content: Record<string, { schema: SchemaObject }>;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  $ref?: string;
  additionalProperties?: boolean | SchemaObject;
  oneOf?: SchemaObject[];
  example?: unknown;
  description?: string;
  minimum?: number;
  enum?: string[];
}

interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  schema: SchemaObject;
  description?: string;
  example?: unknown;
}

let cachedSpec: OpenAPISpec | null = null;

export function loadOpenAPISpec(): OpenAPISpec {
  if (cachedSpec) return cachedSpec;

  const specPath = join(findProjectRoot(), 'openapi.yaml');
  const specContent = readFileSync(specPath, 'utf-8');
  cachedSpec = parse(specContent) as OpenAPISpec;
  return cachedSpec;
}

function resolveRef(spec: OpenAPISpec, ref: string): SchemaObject {
  const path = ref.replace('#/', '').split('/');
  let current: unknown = spec;

  for (const segment of path) {
    current = (current as Record<string, unknown>)[segment];
  }

  return current as SchemaObject;
}

function resolveSchema(spec: OpenAPISpec, schema: SchemaObject): SchemaObject {
  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref);
    return resolveSchema(spec, resolved);
  }

  const result: SchemaObject = { ...schema };

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        resolveSchema(spec, value),
      ])
    );
  }

  if (result.items) {
    result.items = resolveSchema(spec, result.items);
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = resolveSchema(spec, result.additionalProperties);
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map((s) => resolveSchema(spec, s));
  }

  return result;
}

export function getResponseSchema(
  path: string,
  method: string,
  statusCode: number
): SchemaObject | null {
  const spec = loadOpenAPISpec();
  const pathObj = spec.paths[path];

  if (!pathObj) return null;

  const operation = pathObj[method.toLowerCase()];
  if (!operation) return null;

  const response = operation.responses[statusCode.toString()];
  if (!response || !response.content) return null;

  const jsonContent = response.content['application/json'];
  if (!jsonContent) return null;

  return resolveSchema(spec, jsonContent.schema);
}

export function validateResponse(
  path: string,
  method: string,
  statusCode: number,
  body: unknown
): { valid: boolean; errors: string[] } {
  const schema = getResponseSchema(path, method, statusCode);

  if (!schema) {
    if (statusCode === 204) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: [`No schema found for ${method.toUpperCase()} ${path} ${statusCode}`],
    };
  }

  const spec = loadOpenAPISpec();
  const pathObj = spec.paths[path];
  const operation = pathObj[method.toLowerCase()];

  const validator = new OpenAPIResponseValidator({
    responses: operation.responses,
    components: spec.components,
  });

  const result = validator.validateResponse(statusCode, body);

  if (result) {
    return {
      valid: false,
      errors: result.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }

  return { valid: true, errors: [] };
}

export function expectContractCompliance(
  path: string,
  method: string,
  statusCode: number,
  body: unknown
): void {
  const { valid, errors } = validateResponse(path, method, statusCode, body);

  if (!valid) {
    throw new Error(
      `Contract violation for ${method.toUpperCase()} ${path} (${statusCode}):\n${errors.join('\n')}`
    );
  }
}
