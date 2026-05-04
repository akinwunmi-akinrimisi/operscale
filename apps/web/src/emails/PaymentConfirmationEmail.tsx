// payment-confirmation email — sent on Paystack charge.success webhook.
// Spec: docs/specs/email-templates.md.

import { Html, Body, Container, Heading, Text } from '@react-email/components';

export interface PaymentConfirmationEmailProps {
  firstName: string;
  tierName: string;
  amountNgn: number;
  deliveryWindow: string; // e.g. "24 hours"
  brandName: string;
}

export default function PaymentConfirmationEmail(props: PaymentConfirmationEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading as="h2">Payment confirmed, {props.firstName}.</Heading>
          <Text>
            ₦{props.amountNgn.toLocaleString('en-NG')} received for your {props.tierName} package.
            Your calendar is now in production.
          </Text>
          <Text>You'll get your full delivery within {props.deliveryWindow}.</Text>
          <Text style={{ fontSize: 12, color: '#999' }}>— {props.brandName}</Text>
        </Container>
      </Body>
    </Html>
  );
}
