// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

import { SignInForm } from '../../src/app/admin/SignInForm';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  // Override global fetch — the form POSTs to /v1/auth/send-magic-link
  // (rewrite landed in the auth hotfix earlier in this session).
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fetchResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('SignInForm', () => {
  it('renders idle state with disabled button', () => {
    render(<SignInForm />);
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).toBeDisabled();
  });

  it('enables submit once an email is typed', () => {
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'akinolaakinrimisi@gmail.com' },
    });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).not.toBeDisabled();
  });

  it('disables submit when email is cleared after typing', () => {
    render(<SignInForm />);
    const input = screen.getByPlaceholderText(/you@/);
    fireEvent.change(input, { target: { value: 'akinolaakinrimisi@gmail.com' } });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).not.toBeDisabled();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).toBeDisabled();
  });

  it('shows the sent state on a 200 from /v1/auth/send-magic-link', async () => {
    mockFetch.mockResolvedValueOnce(fetchResponse(200, { ok: true }));
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'akinolaakinrimisi@gmail.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() => expect(screen.getByText(/Check your email/)).toBeInTheDocument());
    expect(screen.getByText(/akinolaakinrimisi@gmail\.com/)).toBeInTheDocument();
    // Confirm we hit the right endpoint with normalised email.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/auth\/send-magic-link$/);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: 'akinolaakinrimisi@gmail.com',
    });
  });

  it('shows the error state when the endpoint returns 500 with {error}', async () => {
    mockFetch.mockResolvedValueOnce(fetchResponse(500, { error: 'server_misconfigured' }));
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'x@y.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() =>
      expect(screen.getByText(/Sign-in send failed: server_misconfigured/)).toBeInTheDocument(),
    );
  });

  it('shows a generic error when fetch itself rejects (network)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'));
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'x@y.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() => expect(screen.getByText(/Sign-in failed: NetworkError/)).toBeInTheDocument());
  });
});

describe('SignInForm with ?reason=not_authenticated', () => {
  it('renders the reason banner', async () => {
    vi.doMock('next/navigation', () => ({
      useSearchParams: () => new URLSearchParams('reason=not_authenticated'),
    }));
    vi.resetModules();
    const { SignInForm: SignInFormFresh } = await import('../../src/app/admin/SignInForm');
    render(<SignInFormFresh />);
    expect(screen.getByText(/Sign in to access the CRM/)).toBeInTheDocument();
  });
});
