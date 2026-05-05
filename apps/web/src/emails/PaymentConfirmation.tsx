// apps/web/src/emails/PaymentConfirmation.tsx
//
// React Email component for the payment-confirmation email.
// SOURCE OF TRUTH: docs/specs/email-templates.md §"Template 4: payment-confirmation".
// Phase 4.6 omits the "A receipt is attached" line — Phase 4.7 restores it.

import {
  Html, Head, Body, Container, Section, Heading, Text, Hr, Link,
} from '@react-email/components';
import type { PaymentConfirmationProps } from '@operscale-calendar/agent/lib/payment-confirmation-props';

const body: React.CSSProperties = { backgroundColor: '#f5f4f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 0', color: '#1a1a1a' };
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', padding: '32px', borderRadius: '4px' };
const h2: React.CSSProperties = { fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a5a5a', marginTop: '24px', marginBottom: '8px' };
const p: React.CSSProperties = { fontSize: '16px', lineHeight: 1.55, marginBottom: '12px' };
const small: React.CSSProperties = { fontSize: '13px', color: '#5a5a5a' };

function fmtNgn(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n);
}

function fmtPaidAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
}

export function PaymentConfirmation(props: PaymentConfirmationProps): JSX.Element {
  const subjectPreview = `Payment received — your ${props.brandName} calendar is now in production`;
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={p}>Hi {props.firstName},</Text>
          <Text style={p}>
            Payment confirmed. ₦{fmtNgn(props.amountNgn)} received via {props.paymentMethod} at {fmtPaidAt(props.paidAtIso)}.
          </Text>
          <Text style={p}>Your {props.tierName} package is now in production.</Text>

          <Heading as="h2" style={h2}>WHAT HAPPENS NEXT</Heading>
          <Text style={p}>{`— We start producing your ${props.videoCount} videos and ${props.carouselCount} carousels.`}</Text>
          <Text style={p}>{`— You'll receive your full delivery within ${props.deliveryWindow}.`}</Text>
          <Text style={p}>— I&apos;ll WhatsApp you when delivery is ready.</Text>

          <Hr />

          <Text style={p}>
            Questions? Reply directly or message me on WhatsApp: <Link href={props.founderWhatsappLink}>{props.founderWhatsappLink}</Link>.
          </Text>

          <Text style={p}>— {props.founderName}<br />{props.brandName}</Text>

          <Hr />
          <Text style={small}>Operscale Limited · operscale.cloud/privacy · operscale.cloud/terms</Text>
        </Container>
        {/* Subject preview helper — hidden, used by tests */}
        <span style={{ display: 'none' }}>{subjectPreview}</span>
      </Body>
    </Html>
  );
}

export default PaymentConfirmation;
