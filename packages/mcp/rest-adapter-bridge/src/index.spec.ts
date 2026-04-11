/**
 * REST Adapter Bridge — Unit Tests
 *
 * Tests the exported helper functions (parseConfig, endpointToTool,
 * buildAuthHeaders, buildUrl, buildBody, executeEndpoint) without
 * spawning the actual stdio MCP server.
 */

import { jest } from '@jest/globals';
import {
  parseConfig,
  endpointToTool,
  buildAuthHeaders,
  buildUrl,
  buildBody,
  executeEndpoint,
  type RestAdapterConfig,
  type RestEndpoint,
  type RestAdapterAuth,
} from './index.js';

// ─── parseConfig ─────────────────────────────────────────────────────────

describe('parseConfig', () => {
  const originalEnv = process.env.REST_ADAPTER_CONFIG;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REST_ADAPTER_CONFIG;
    } else {
      process.env.REST_ADAPTER_CONFIG = originalEnv;
    }
  });

  it('should throw when REST_ADAPTER_CONFIG is not set', () => {
    delete process.env.REST_ADAPTER_CONFIG;
    expect(() => parseConfig()).toThrow('REST_ADAPTER_CONFIG environment variable is required');
  });

  it('should throw when config has no baseUrl', () => {
    process.env.REST_ADAPTER_CONFIG = JSON.stringify({
      auth: { type: 'none' },
      endpoints: [{ name: 'test', description: 'Test', method: 'GET', path: '/test' }],
    });
    expect(() => parseConfig()).toThrow('must have baseUrl');
  });

  it('should throw when config has no endpoints', () => {
    process.env.REST_ADAPTER_CONFIG = JSON.stringify({
      baseUrl: 'https://api.example.com',
      auth: { type: 'none' },
      endpoints: [],
    });
    expect(() => parseConfig()).toThrow('at least one endpoint');
  });

  it('should parse valid config', () => {
    const config = {
      baseUrl: 'https://api.example.com',
      auth: { type: 'none' },
      endpoints: [{ name: 'test', description: 'Test', method: 'GET', path: '/test' }],
    };
    process.env.REST_ADAPTER_CONFIG = JSON.stringify(config);
    const result = parseConfig();
    expect(result.baseUrl).toBe('https://api.example.com');
    expect(result.endpoints).toHaveLength(1);
  });
});

// ─── endpointToTool ──────────────────────────────────────────────────────

describe('endpointToTool', () => {
  it('should generate tool from endpoint with no params', () => {
    const endpoint: RestEndpoint = {
      name: 'list_items',
      description: 'List all items',
      method: 'GET',
      path: '/items',
    };
    const tool = endpointToTool(endpoint);
    expect(tool.name).toBe('list_items');
    expect(tool.description).toBe('List all items');
    expect(tool.inputSchema.properties).toEqual({});
  });

  it('should include path params as required', () => {
    const endpoint: RestEndpoint = {
      name: 'get_user',
      description: 'Get a user',
      method: 'GET',
      path: '/users/{userId}',
      pathParams: {
        userId: { type: 'string', description: 'User ID' },
      },
    };
    const tool = endpointToTool(endpoint);
    expect(tool.inputSchema.required).toEqual(['userId']);
    expect((tool.inputSchema.properties as Record<string, any>).userId.type).toBe('string');
  });

  it('should include query params (optional unless required)', () => {
    const endpoint: RestEndpoint = {
      name: 'search',
      description: 'Search',
      method: 'GET',
      path: '/search',
      queryParams: {
        q: { type: 'string', required: true },
        limit: { type: 'integer', default: 10 },
      },
    };
    const tool = endpointToTool(endpoint);
    expect(tool.inputSchema.required).toContain('q');
    expect(tool.inputSchema.required).not.toContain('limit');
    expect((tool.inputSchema.properties as Record<string, any>).limit.default).toBe(10);
    // integer maps to number in JSON Schema
    expect((tool.inputSchema.properties as Record<string, any>).limit.type).toBe('number');
  });

  it('should include body schema fields', () => {
    const endpoint: RestEndpoint = {
      name: 'create_user',
      description: 'Create user',
      method: 'POST',
      path: '/users',
      body: {
        type: 'json',
        schema: {
          name: { type: 'string', required: true, description: 'Name' },
          age: { type: 'integer' },
        },
      },
    };
    const tool = endpointToTool(endpoint);
    expect(tool.inputSchema.required).toContain('name');
    expect((tool.inputSchema.properties as Record<string, any>).name.description).toBe('Name');
  });
});

// ─── buildAuthHeaders ────────────────────────────────────────────────────

describe('buildAuthHeaders', () => {
  it('should return empty headers for auth type none', () => {
    expect(buildAuthHeaders({ type: 'none' })).toEqual({});
  });

  it('should return Bearer Authorization header', () => {
    const headers = buildAuthHeaders({ type: 'bearer', token: 'tok123' });
    expect(headers['Authorization']).toBe('Bearer tok123');
  });

  it('should support custom header name and prefix for bearer', () => {
    const headers = buildAuthHeaders({
      type: 'bearer',
      token: 'tok',
      headerName: 'X-Api-Token',
      headerPrefix: 'Token',
    });
    expect(headers['X-Api-Token']).toBe('Token tok');
  });

  it('should return Basic Authorization header', () => {
    const headers = buildAuthHeaders({ type: 'basic', username: 'user', password: 'pass' });
    const expected = Buffer.from('user:pass').toString('base64');
    expect(headers['Authorization']).toBe(`Basic ${expected}`);
  });

  it('should return API key header when location is header', () => {
    const headers = buildAuthHeaders({
      type: 'api_key',
      apiKeyName: 'X-API-Key',
      apiKeyLocation: 'header',
      apiKeyValue: 'secret123',
    });
    expect(headers['X-API-Key']).toBe('secret123');
  });

  it('should NOT add header when api_key location is query', () => {
    const headers = buildAuthHeaders({
      type: 'api_key',
      apiKeyName: 'key',
      apiKeyLocation: 'query',
      apiKeyValue: 'secret',
    });
    expect(Object.keys(headers)).toHaveLength(0);
  });
});

// ─── buildUrl ────────────────────────────────────────────────────────────

describe('buildUrl', () => {
  const auth: RestAdapterAuth = { type: 'none' };

  it('should resolve path params', () => {
    const endpoint: RestEndpoint = {
      name: 'get',
      description: '',
      method: 'GET',
      path: '/users/{id}',
      pathParams: { id: { type: 'string' } },
    };
    const url = buildUrl('https://api.example.com', endpoint, { id: '42' }, auth);
    expect(url).toBe('https://api.example.com/users/42');
  });

  it('should add query params', () => {
    const endpoint: RestEndpoint = {
      name: 'search',
      description: '',
      method: 'GET',
      path: '/search',
      queryParams: { q: { type: 'string' }, limit: { type: 'integer', default: 10 } },
    };
    const url = buildUrl('https://api.example.com', endpoint, { q: 'test' }, auth);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q')).toBe('test');
    expect(parsed.searchParams.get('limit')).toBe('10');
  });

  it('should add api_key as query param when location is query', () => {
    const apiKeyAuth: RestAdapterAuth = {
      type: 'api_key',
      apiKeyName: 'key',
      apiKeyLocation: 'query',
      apiKeyValue: 'secret',
    };
    const endpoint: RestEndpoint = {
      name: 'test',
      description: '',
      method: 'GET',
      path: '/test',
    };
    const url = buildUrl('https://api.example.com', endpoint, {}, apiKeyAuth);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('key')).toBe('secret');
  });

  it('should encode path param values', () => {
    const endpoint: RestEndpoint = {
      name: 'get',
      description: '',
      method: 'GET',
      path: '/items/{name}',
      pathParams: { name: { type: 'string' } },
    };
    const url = buildUrl('https://api.example.com', endpoint, { name: 'foo bar' }, auth);
    expect(url).toContain('foo%20bar');
  });
});

// ─── buildBody ───────────────────────────────────────────────────────────

describe('buildBody', () => {
  it('should return undefined for endpoint with no body schema', () => {
    const endpoint: RestEndpoint = {
      name: 'get',
      description: '',
      method: 'GET',
      path: '/test',
    };
    expect(buildBody(endpoint, { some: 'value' })).toBeUndefined();
  });

  it('should build body from schema fields', () => {
    const endpoint: RestEndpoint = {
      name: 'create',
      description: '',
      method: 'POST',
      path: '/items',
      body: {
        type: 'json',
        schema: {
          name: { type: 'string', required: true },
          count: { type: 'integer', default: 1 },
        },
      },
    };
    const body = buildBody(endpoint, { name: 'Item 1' }) as Record<string, unknown>;
    expect(body.name).toBe('Item 1');
    expect(body.count).toBe(1); // default applied
  });
});

// ─── executeEndpoint ─────────────────────────────────────────────────────

describe('executeEndpoint', () => {
  const config: RestAdapterConfig = {
    baseUrl: 'https://api.example.com',
    auth: { type: 'none' },
    endpoints: [],
    timeout: 5000,
  };

  const endpoint: RestEndpoint = {
    name: 'get_users',
    description: 'Get users',
    method: 'GET',
    path: '/users',
  };

  let fetchMock: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return response text on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{"users":[]}'),
    });

    const result = await executeEndpoint(config, endpoint, {});
    expect(result.content[0].text).toBe('{"users":[]}');
    expect(result.isError).toBeUndefined();
  });

  it('should return error for non-ok response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });

    const result = await executeEndpoint(config, endpoint, {});
    expect(result.content[0].text).toBe('HTTP 404: Not Found');
    expect(result.isError).toBe(true);
  });

  it('should return error on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await executeEndpoint(config, endpoint, {});
    expect(result.content[0].text).toContain('Request failed: Network error');
    expect(result.isError).toBe(true);
  });

  it('should return timeout message on AbortError', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    const result = await executeEndpoint(config, endpoint, {});
    expect(result.content[0].text).toContain('timed out');
    expect(result.isError).toBe(true);
  });

  it('should send POST body as JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: () => Promise.resolve('{"id": "1"}'),
    });

    const postEndpoint: RestEndpoint = {
      name: 'create_user',
      description: 'Create user',
      method: 'POST',
      path: '/users',
      body: { type: 'json', schema: { name: { type: 'string', required: true } } },
    };

    await executeEndpoint(config, postEndpoint, { name: 'Alice' });

    const fetchCall = fetchMock.mock.calls[0] as any[];
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].body).toBe(JSON.stringify({ name: 'Alice' }));
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
  });

  it('should pass auth headers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('ok'),
    });

    const authedConfig: RestAdapterConfig = {
      ...config,
      auth: { type: 'bearer', token: 'mytoken' },
    };

    await executeEndpoint(authedConfig, endpoint, {});

    const fetchCall = fetchMock.mock.calls[0] as any[];
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer mytoken');
  });

  it('should return "(empty response)" for empty body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(''),
    });

    const result = await executeEndpoint(config, endpoint, {});
    expect(result.content[0].text).toBe('(empty response)');
  });
});
