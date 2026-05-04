// recovery-payment email — sent ~24h after payment_initiated if still unpaid.
// Spec: docs/specs/email-templates.md.

import { Html, Body, Container, Text, Link } from '@react-email/components';

export interface RecoveryPaymentEmailProps {
  firstName: string;
  paystackUrl: string;
  brandName: string;
}

export default function RecoveryPaymentEmail(props: RecoveryPaymentEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Text>Hey {props.firstName} — saw you started checkout but didn't finish.</Text>
          <Text>
            Common reasons: card declined (try bank transfer or USSD), wanted to think it over.
          </Text>
          <Text>
            <Link href={props.paystackUrl}>Your payment link, still good</Link>
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>— {props.brandName}</Text>
        </Container>
      </Body>
    </Html>
  );
}
