// auto-ack email — sent within 30s of form submit. Per docs/specs/email-templates.md §auto-ack.
//
// Trigger: agent /v1/brief/submit fires this synchronously before AI analysis.
// Best-effort: Resend failure must not block submit (per customer-journey.md §2.6 failure modes).
//
// Subject (set by sender, not this template):
//   "Got your Operscale brief — personalised version coming within an hour"

import {
  Html,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Link,
  Section,
} from '@react-email/components';

export interface AutoAckEmailProps {
  firstName: string;
  brandName: string; // customer's brand, NOT ours
  tierDisplayName: string; // "Starter" / "Standard" / "Calendar"
  videoCount: number;
  carouselCount: number;
  deliveryWindow: string; // e.g. "24 hours"
  watTimestamp: string; // when the brief landed, formatted in WAT
  founderWhatsappNumber: string; // E.164 with leading +
  founderName: string;
}

export default function AutoAckEmail({
  firstName,
  brandName,
  tierDisplayName,
  videoCount,
  carouselCount,
  deliveryWindow,
  watTimestamp,
  founderWhatsappNumber,
  founderName,
}: AutoAckEmailProps) {
  const wa = founderWhatsappNumber.replace(/\D/g, '');
  return (
    <Html>
      <Body style={{ fontFamily: '-apple-system,system-ui,sans-serif', color: '#111' }}>
        <Container style={{ maxWidth: 560, padding: 24 }}>
          <Heading as="h2" style={{ margin: '0 0 16px' }}>
            Got your brief, {firstName}.
          </Heading>

          <Text>
            We received your brief for <strong>{brandName}</strong> at {watTimestamp} (WAT).
          </Text>

          <Section style={{ margin: '24px 0' }}>
            <Heading as="h3" style={{ fontSize: 16, margin: '0 0 8px' }}>
              What happens next
            </Heading>
            <Text style={{ margin: '0 0 8px' }}>
              <strong>Within the next hour</strong> during business hours (or by 9 AM tomorrow if
              you submitted late evening Lagos time), we&apos;ll send your personalised content
              brief — three angles, a sample script, visual direction, and a payment link.
            </Text>
            <Text style={{ margin: '0 0 8px' }}>
              Once payment lands, your <strong>{tierDisplayName}</strong> calendar of{' '}
              <strong>{videoCount} videos and {carouselCount} carousels</strong> ships within{' '}
              <strong>{deliveryWindow}</strong>.
            </Text>
          </Section>

          <Hr />

          <Text>
            Need to add anything or have a question? Reply to this email or message {founderName}{' '}
            on{' '}
            <Link href={`https://wa.me/${wa}`}>WhatsApp</Link>.
          </Text>

          <Hr />

          <Text style={{ fontSize: 12, color: '#888', margin: 0 }}>
            Operscale Limited · <Link href="https://operscale.cloud/privacy">Privacy</Link> ·{' '}
            <Link href="https://operscale.cloud/terms">Terms</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
