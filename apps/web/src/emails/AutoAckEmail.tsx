// auto-ack email — sent within 30s of form submit (template, not personalised).
// Spec: docs/specs/email-templates.md.
// Trigger: agent/v1/brief/submit fires this synchronously before AI analysis.

import { Html, Body, Container, Heading, Text, Hr } from '@react-email/components';

export interface AutoAckEmailProps {
  firstName: string;
  brandName: string;
  founderWhatsapp: string;
}

export default function AutoAckEmail({ firstName, brandName, founderWhatsapp }: AutoAckEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading as="h2">Got your brief, {firstName}.</Heading>
          <Text>
            We're reading through it now. Within the next hour during business
            hours you'll get a personalised plan with a payment link.
          </Text>
          <Hr />
          <Text>
            Need to reach me directly? <a href={`https://wa.me/${founderWhatsapp.replace(/\D/g, '')}`}>WhatsApp</a>.
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>
            — {brandName}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
