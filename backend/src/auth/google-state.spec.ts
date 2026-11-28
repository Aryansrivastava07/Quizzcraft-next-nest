import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GOOGLE_STATE_TTL_MS, GoogleOAuthState } from '../schemas/google-oauth-state.schema';

describe('Google sign-in state', () => {
  const records = new Map<string, GoogleOAuthState>();
  const states = {
    create(record: GoogleOAuthState) {
      records.set(record._id, record);
    },
    findOneAndDelete(filter: { _id: string; browserHash: string; expiresAt: { $gt: Date } }) {
      return {
        lean() {
          const record = records.get(filter._id);
          if (!record || record.browserHash !== filter.browserHash || record.expiresAt <= filter.expiresAt.$gt) return null;
          records.delete(record._id);
          return record;
        },
      };
    },
  };
  const config = new ConfigService({ GOOGLE_CLIENT_ID: 'test-id', GOOGLE_CLIENT_SECRET: 'test-secret' });
  const service = new AuthService(null!, null!, null!, null!, config, null!, states as never);
  const controller = new AuthController(service);
  const exchange = jest.spyOn(service, 'handleGoogleCallback').mockResolvedValue({
    accessToken: 'access', refreshToken: 'refresh', redirect: '/profile', user: {} as never,
  });
  const request = { headers: {}, secure: true, protocol: 'https', get: () => 'example.test' };

  function response() {
    return { cookie: jest.fn(), clearCookie: jest.fn(), set: jest.fn(), redirect: jest.fn() };
  }

  async function start() {
    const res = response();
    await controller.googleAuth(request, res as unknown as Response, '/profile', 'school', 'group');
    const state = new URL(res.redirect.mock.calls[0][0]).searchParams.get('state')!;
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(options).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax', maxAge: GOOGLE_STATE_TTL_MS });
    return { state, cookies: { [name]: token } };
  }

  async function callback(cookies: Record<string, string>, state?: string, error?: string) {
    const res = response();
    await controller.googleCallback({ ...request, cookies }, res as unknown as Response, 'code', state, error);
    return res;
  }

  beforeEach(() => {
    records.clear();
    exchange.mockClear();
  });

  it('allows one concurrent callback and restores the original context', async () => {
    const { state, cookies } = await start();
    const results = await Promise.all([callback(cookies, state), callback(cookies, state)]);
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith('code', expect.objectContaining({
      redirect: '/profile', org: 'school', group: 'group',
    }), 'https://example.test/auth/google/callback');
    expect(results.filter(res => res.clearCookie.mock.calls.length)).toHaveLength(1);
  });

  it('rejects missing or mismatched state and leaves the original sign-in usable', async () => {
    const first = await start();
    const second = await start();
    expect(first.state).not.toBe(second.state);
    await callback({}, first.state);
    await callback(first.cookies);
    await callback(first.cookies, 'invalid');
    await callback({ [Object.keys(first.cookies)[0]]: Object.values(second.cookies)[0] }, first.state);
    expect(exchange).not.toHaveBeenCalled();
    await callback(first.cookies, first.state);
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('rejects expired state even before database cleanup', async () => {
    const { state, cookies } = await start();
    records.get(state)!.expiresAt = new Date(0);
    await callback(cookies, state);
    expect(exchange).not.toHaveBeenCalled();
  });

  it('consumes a valid transaction when Google returns an error', async () => {
    const { state, cookies } = await start();
    const denied = await callback(cookies, state, 'access_denied');
    expect(denied.redirect).toHaveBeenCalledWith(expect.stringContaining('error=access_denied'));
    await callback(cookies, state);
    expect(exchange).not.toHaveBeenCalled();
  });
});
