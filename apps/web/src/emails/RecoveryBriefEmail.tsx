// recovery-brief email — sent ~6h after brief email if not paid.
// Spec: docs/specs/email-templates.md.

import { Html, Body, Container, Text, Link } from '@react-email/components';

export interface RecoveryBriefEmailProps {
  firstName: string;
  paystackUrl: string;
  brandName: string;
}

export default function RecoveryBriefEmail(props: RecoveryBriefEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Text>Hey {props.firstName} — your brief's ready when you are.</Text>
          <Text>
            <Link href={props.paystackUrl}>Continue to payment</Link>
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>— {props.brandName}</Text>
        </Container>
      </Body>
    </Html>
  );
}
