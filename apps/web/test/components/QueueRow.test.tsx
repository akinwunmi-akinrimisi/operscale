// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueueRow, type QueueRowData } from '../../src/app/admin/pending-review/QueueRow';

afterEach(() => {
  cleanup();
});

const FIXED_NOW = new Date('2026-05-06T12:00:00Z').getTime();

function makeRow(overrides: Partial<QueueRowData> = {}): QueueRowData {
  return {
    order_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    brief_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    brand_name: 'Acme',
    customer_name: 'Jane',
    niche: 'fashion',
    tier: 'standard',
    submitted_at: '2026-05-06T11:50:00Z',
    has_photos: true,
    ...overrides,
  };
}

describe('QueueRow time-since badge', () => {
  it('renders green badge for ≤30 minutes (10m)', () => {
    render(<QueueRow row={makeRow({ submitted_at: '2026-05-06T11:50:00Z' })} now={FIXED_NOW} />);
    const badge = screen.getByText('10m');
    expect(badge.className).toContain('bg-green-100');
  });

  it('renders amber badge for 31-120 minutes (90m)', () => {
    render(
      <QueueRow row={makeRow({ submitted_at: '2026-05-06T10:30:00Z' })} now={FIXED_NOW} />,
    );
    const badge = screen.getByText('1h');
    expect(badge.className).toContain('bg-amber-100');
  });

  it('renders red badge for >120 minutes (240m)', () => {
    render(<QueueRow row={makeRow({ submitted_at: '2026-05-06T08:00:00Z' })} now={FIXED_NOW} />);
    const badge = screen.getByText('4h');
    expect(badge.className).toContain('bg-red-100');
  });

  it('renders camera icon when has_photos is true', () => {
    render(<QueueRow row={makeRow({ has_photos: true })} now={FIXED_NOW} />);
    expect(screen.getByText('\u{1F4F7}')).toBeInTheDocument();
  });

  it('hides camera icon when has_photos is false', () => {
    render(<QueueRow row={makeRow({ has_photos: false })} now={FIXED_NOW} />);
    expect(screen.queryByText('\u{1F4F7}')).not.toBeInTheDocument();
  });

  it('falls back to em-dash for missing brand_name', () => {
    render(<QueueRow row={makeRow({ brand_name: null })} now={FIXED_NOW} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
