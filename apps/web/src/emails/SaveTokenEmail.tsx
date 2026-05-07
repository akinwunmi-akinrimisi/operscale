// save-token email — fired at form step 3 boundary with the resume URL.
// Per docs/specs/email-templates.md §save-token.
//
// Trigger: /v1/brief/save step=3 issues briefs.save_token, then sends this
// synchronously. Best-effort: Resend failure does not block step-3 progress
// (customer-journey.md §2.4).
//
// Subject (set by sender):
//   "Your Operscale brief draft is saved"

import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Link,
  Hr,
  Section,
} from '@react-email/components';

export interface SaveTokenEmailProps {
  firstName: string;
  resumeUrl: string;
  tierDisplayName: string;
}

export default function SaveTokenEmail({
  firstName,
  resumeUrl,
  tierDisplayName,
}: SaveTokenEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: '-apple-system,system-ui,sans-serif', color: '#111' }}>
        <Container style={{ maxWidth: 520, padding: 24 }}>
          <Heading as="h2" style={{ margin: '0 0 16px' }}>
            Your draft is saved, {firstName}.
          </Heading>

          <Text>
            We&apos;ve saved your{' '}
            <strong>{tierDisplayName}</strong> brief draft. Pick it back up whenever you&apos;re
            ready — the link below works for 7 days:
          </Text>

          <Section style={{ margin: '24px 0' }}>
            <Link
              href={resumeUrl}
              style={{
                background: '#111',
                color: '#fff',
                padding: '12px 20px',
                borderRadius: 6,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Continue my brief
            </Link>
          </Section>

          <Text style={{ fontSize: 13, color: '#666', wordBreak: 'break-all' }}>
            Or copy this URL: {resumeUrl}
          </Text>

          <Hr />

          <Text style={{ fontSize: 12, color: '#888', margin: 0 }}>
            Operscale Limited · <Link href="https://operscale.cloud/privacy">Privacy</Link> ·{' '}
            <Link href="https://operscale.cloud/terms">Terms</Link>
            <br />
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
