import {
  Html, Head, Body, Container, Section, Heading, Text, Button, Hr, Link,
} from '@react-email/components';
import type { BriefEmailProps } from '@operscale-calendar/agent/lib/snapshot-to-email-props';

const body: React.CSSProperties = { backgroundColor: '#f5f4f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 0', color: '#1a1a1a' };
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', padding: '32px', borderRadius: '4px' };
const h2: React.CSSProperties = { fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5a5a5a', marginTop: '24px', marginBottom: '8px' };
const p: React.CSSProperties = { fontSize: '16px', lineHeight: 1.55, marginBottom: '12px' };
const small: React.CSSProperties = { fontSize: '13px', color: '#5a5a5a' };
const buttonStyle: React.CSSProperties = { backgroundColor: '#1a1a1a', color: '#ffffff', padding: '14px 24px', borderRadius: '4px', textDecoration: 'none', display: 'inline-block', fontWeight: 600 };

function fmtNgn(n: number): string {
  return new Intl.NumberFormat('en-NG').format(n);
}

export function BriefEmail(props: BriefEmailProps): JSX.Element {
  const subjectPreview = `${props.brandName} brief — ${props.tierName}, ${props.videoCount} videos`;
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Text style={p}>Hi {props.firstName},</Text>
          <Text style={p}>Here&apos;s your personalised content brief.</Text>

          <Heading as="h2" style={h2}>What we heard</Heading>
          <Text style={p}>{props.briefSummary}</Text>

          <Heading as="h2" style={h2}>3 angles we&apos;d open the calendar with</Heading>
          {props.angles.map((angle, i) => (
            <Section key={i}>
              <Text style={{ ...p, fontWeight: 600 }}>{i + 1}. {angle.title}</Text>
              <Text style={p}>Hook: {angle.hook}</Text>
              <Text style={p}>Why this works for you: {angle.whyItFits}</Text>
            </Section>
          ))}

          <Heading as="h2" style={h2}>A taste of how the first video would land</Heading>
          <Text style={p}>Topic: {props.scriptSeed.topic}</Text>
          <Text style={p}>The first 1.5 seconds: &ldquo;{props.scriptSeed.openingHook}&rdquo;</Text>
          <Text style={p}>The 30-second arc:</Text>
          {props.scriptSeed.outline.map((beat, i) => (
            <Text key={i} style={p}>— {beat}</Text>
          ))}

          <Heading as="h2" style={h2}>The visual direction we have in mind</Heading>
          <Text style={p}>{props.visualStyle.recommendedCameraTreatment}</Text>
          <Text style={p}>Captions: {props.visualStyle.recommendedCaptionStyle}</Text>
          {props.photoAesthetic && (
            <Text style={p}>A note on your reference photos: {props.photoAesthetic.recommendedAvatarTreatment}</Text>
          )}

          <Heading as="h2" style={h2}>Your package</Heading>
          <Text style={p}>{props.tierName} — ₦{fmtNgn(props.priceNgn)}</Text>
          <Text style={p}>{props.videoCount} short-form videos ({props.ugcCount} with you on camera, {props.t2vCount} cinematic)</Text>
          <Text style={p}>{props.carouselCount} carousels ({props.carouselPages} image cards total)</Text>
          <Text style={p}>Delivered in {props.deliveryWindow}.</Text>

          {props.upsell && (
            <Section>
              <Heading as="h2" style={h2}>One thought — would the {props.upsell.recommendedTier} package be a better fit?</Heading>
              <Text style={p}>{props.upsell.reasoning}</Text>
              <Text style={p}>That&apos;s an extra ₦{fmtNgn(props.upsell.priceDeltaNgn)}, totalling ₦{fmtNgn(props.upsell.recommendedTierPriceNgn)}. You can choose either tier on the payment page.</Text>
            </Section>
          )}

          <Hr />

          <Heading as="h2" style={h2}>Next step</Heading>
          <Text style={p}>Pay securely via Paystack:</Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={props.paymentLink} style={buttonStyle}>Pay now</Button>
          </Section>
          <Text style={small}>Or copy this link: <Link href={props.paymentLink}>{props.paymentLink}</Link></Text>

          <Text style={p}>If anything in this brief doesn&apos;t quite fit, just reply to this email with what you&apos;d change. No need to pay yet.</Text>

          <Text style={p}>— {props.founderName}<br />{props.brandName}</Text>

          <Hr />
          <Text style={small}>Operscale Limited · operscale.cloud/privacy · operscale.cloud/terms</Text>
        </Container>
        {/* Subject preview helper for tests */}
        <span style={{ display: 'none' }}>{subjectPreview}</span>
      </Body>
    </Html>
  );
}

export default BriefEmail;
