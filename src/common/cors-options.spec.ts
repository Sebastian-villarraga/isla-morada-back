import { createCorsOptions } from './cors-options';

describe('CORS origin allowlist', () => {
  function isAllowed(options: ReturnType<typeof createCorsOptions>, origin: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      options.origin(origin, (error, allow) => {
        if (error) reject(error);
        else resolve(Boolean(allow));
      });
    });
  }

  it('allows only exact configured local, production, and approved preview origins', async () => {
    const options = createCorsOptions(
      'http://localhost:3000, https://isla-morada.vercel.app, https://preview-approved.vercel.app',
      'production',
    );

    await expect(isAllowed(options, 'http://localhost:3000')).resolves.toBe(true);
    await expect(isAllowed(options, 'https://isla-morada.vercel.app')).resolves.toBe(true);
    await expect(isAllowed(options, 'https://preview-approved.vercel.app')).resolves.toBe(true);
    await expect(isAllowed(options, 'https://other-preview.vercel.app')).resolves.toBe(false);
  });

  it('rejects a wildcard allowlist in production', () => {
    expect(() => createCorsOptions('*', 'production')).toThrow('FRONTEND_URL no puede incluir * en producción');
  });
});