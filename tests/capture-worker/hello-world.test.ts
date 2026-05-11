import { describe, expect, it, vi, beforeEach } from 'vitest';

const { infoMock, errorMock } = vi.hoisted(() => ({
  infoMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('@ncp/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: infoMock,
    warn: vi.fn(),
    error: errorMock,
    fatal: vi.fn(),
  }),
}));

interface InngestFunctionLike {
  id: () => string;
}

describe('capture-worker hello-world Inngest function', () => {
  beforeEach(() => {
    infoMock.mockClear();
    errorMock.mockClear();
  });

  it('is exported with id "hello-world"', async () => {
    const mod = await import('../../artifacts/capture-worker/src/index.js');
    const fn = mod.helloWorld as unknown as InngestFunctionLike;
    expect(fn.id()).toBe('hello-world');
  });

  it('handler returns { ok: true } when invoked with a fake event', async () => {
    const mod = await import('../../artifacts/capture-worker/src/index.js');
    const result = await mod.helloWorldHandler();
    expect(result).toEqual({ ok: true });
  });

  it('handler calls logger.info exactly once with source: "capture-worker" context', async () => {
    const mod = await import('../../artifacts/capture-worker/src/index.js');
    await mod.helloWorldHandler();
    expect(infoMock).toHaveBeenCalledTimes(1);
    const firstCall = infoMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({ source: 'capture-worker' });
  });
});
