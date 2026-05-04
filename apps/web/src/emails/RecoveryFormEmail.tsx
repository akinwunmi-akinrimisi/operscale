// recovery-form email — sent ~24h after form abandonment at step ≥ 3.
// Spec: docs/specs/email-templates.md.
// Triggered by drop-off-recovery Edge Function.

import { Html, Body, Container, Text, Link } from '@react-email/components';

export interface RecoveryFormEmailProps {
  firstName: string;
  resumeUrl: string;
  brandName: string;
}

export default function RecoveryFormEmail(props: RecoveryFormEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Text>Hey {props.firstName} — saw you were partway through your brief.</Text>
          <Text>
            <Link href={props.resumeUrl}>Pick up where you left off</Link>
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>— {props.brandName}</Text>
        </Container>
      </Body>
    </Html>
  );
}
