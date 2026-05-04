// save-token email — sent at form step 3 with resume link.
// Spec: docs/specs/email-templates.md.

import { Html, Body, Container, Heading, Text, Link } from '@react-email/components';

export interface SaveTokenEmailProps {
  firstName: string;
  resumeUrl: string;
  brandName: string;
}

export default function SaveTokenEmail({ firstName, resumeUrl, brandName }: SaveTokenEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading as="h2">Saved your progress, {firstName}.</Heading>
          <Text>Pick it back up whenever you want:</Text>
          <Text>
            <Link href={resumeUrl}>{resumeUrl}</Link>
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>— {brandName}</Text>
        </Container>
      </Body>
    </Html>
  );
}
