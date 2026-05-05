// apps/agent/src/lib/auth/verify-jwt.ts
//
// Phase 4 routes use this for 401/403 routing only. Full signature verification
// happens at the Supabase RLS layer when the route's downstream call hits the
// table. This helper just parses the role claim out of the Authorization header.

export interface JwtClaims {
  role: string;
  sub: string | null;
}

export function verifyJwt(headers: Headers): JwtClaims | null {
  const auth = headers.get('Authorization') ?? headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  const token = auth.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const bodyJson = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const claims = JSON.parse(bodyJson);
    if (typeof claims.role !== 'string') return null;
    return {
      role: claims.role,
      sub: typeof claims.sub === 'string' ? claims.sub : null,
    };
  } catch {
    return null;
  }
}
