import { describe, it, expect } from 'vitest';
import { configFromEnv } from '../../scripts/write-config.mjs';
import { parseConfig } from '../../src/net/config.js';

describe('write-config', () => {
  it('writes nothing when nothing is set', () => {
    expect(configFromEnv({})).toBeNull();
    expect(configFromEnv({ KRONLAND_SERVER: '  ', KRONLAND_SOURCES: '' })).toBeNull();
  });

  it('builds a document the game accepts', () => {
    const doc = configFromEnv({ KRONLAND_SERVER: 'https://api.example.org/', KRONLAND_SOURCES: 'https://a.example/catalog.json, https://b.example/catalog.json\nhttps://a.example/catalog.json' });
    expect(doc).toEqual({ format: 'kronland-config', version: 1, server: 'https://api.example.org', sources: ['https://a.example/catalog.json', 'https://b.example/catalog.json'] });
    expect(parseConfig(doc).server).toBe('https://api.example.org');
  });

  it('works with sources only', () => {
    const doc = configFromEnv({ KRONLAND_SOURCES: 'https://a.example/catalog.json' });
    expect(doc.server).toBeUndefined();
    expect(parseConfig(doc).sources).toHaveLength(1);
  });

  it('refuses addresses that are not http(s)', () => {
    expect(() => configFromEnv({ KRONLAND_SERVER: 'ftp://x' })).toThrow(/KRONLAND_SERVER/);
    expect(() => configFromEnv({ KRONLAND_SOURCES: 'javascript:alert(1)' })).toThrow(/KRONLAND_SOURCES/);
  });
});
