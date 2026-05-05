import { describe, it, expect } from 'vitest';
import { verifyJwt } from './verify-jwt';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

describe('verifyJwt', () => {
  it('returns null when Authorization header is missing', () => {
    const headers = new Headers();
    expect(verifyJwt(headers)).toBeNull();
  });

  it('returns null when Authorization header does not start with Bearer', () => {
    const headers = new Headers({ Authorization: 'Basic abc' });
    expect(verifyJwt(headers)).toBeNull();
  });

  it('returns null when the JWT body cannot be parsed', () => {
    const headers = new Headers({ Authorization: 'Bearer not.a.jwt' });
    expect(verifyJwt(headers)).toBeNull();
  });

  it('returns { role, sub } from a founder-claim JWT', () => {
    const token = makeJwt({ role: 'founder', sub: 'user-1' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    expect(verifyJwt(headers)).toEqual({ role: 'founder', sub: 'user-1' });
  });

  it('returns { role, sub } from a service-role JWT', () => {
    const token = makeJwt({ role: 'service_role', sub: 'system' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    expect(verifyJwt(headers)).toEqual({ role: 'service_role', sub: 'system' });
  });

  it('returns sub=null when the JWT body has no sub claim', () => {
    const token = makeJwt({ role: 'founder' });
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    expect(verifyJwt(headers)).toEqual({ role: 'founder', sub: null });
  });
});
