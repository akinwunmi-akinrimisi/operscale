// brief email — sent on founder approval, contains personalised plan + Paystack link.
// Spec: docs/specs/email-templates.md + docs/specs/founder-review-flow.md "Approve Action".
// Subject template: "Your Operscale calendar brief is ready — {{tier}}, {{count}} videos"

import { Html, Body, Container, Heading, Text, Section, Link } from '@react-email/components';

export interface BriefEmailProps {
  firstName: string;
  tier: 'starter' | 'standard' | 'calendar';
  videoCount: number;
  carouselCount: number;
  briefSummary: string;
  recommendedAngles: { angle: string; hook: string }[];
  paystackUrl: string;
  amountNgn: number;
  brandName: string;
}

export default function BriefEmail(props: BriefEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading as="h2">Your calendar brief, {props.firstName}.</Heading>
          <Text>
            Tier: <strong>{props.tier}</strong> — {props.videoCount} videos +{' '}
            {props.carouselCount} carousels.
          </Text>
          <Section>
            <Heading as="h3">What we'll make</Heading>
            <Text>{props.briefSummary}</Text>
          </Section>
          <Section>
            <Heading as="h3">Three angles we recommend</Heading>
            {/* TODO(Operscale): render full angles + hooks per spec */}
          </Section>
          <Section>
            <Text>
              <Link href={props.paystackUrl}>
                Pay ₦{props.amountNgn.toLocaleString('en-NG')} to start production
              </Link>
            </Text>
          </Section>
          <Text style={{ fontSize: 12, color: '#999' }}>— {props.brandName}</Text>
        </Container>
      </Body>
    </Html>
  );
}
