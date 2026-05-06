// Source of truth for form_payload keys: apps/agent/src/worker/process-job.ts
// (projectBriefRowToAnalyzerInput) + apps/agent/src/lib/types/v2.ts
// (BriefAnalyzerInput). Keep this interface aligned with that projector — if
// process-job.ts adds/renames a key, this panel must move with it.
interface FormPayload {
  // Identity / niche
  brand_name?: string;
  niche_slug?: string;
  niche_label?: string;

  // Step 1 — owner contact
  owner_name?: string;
  phone_e164?: string;
  email?: string;

  // Step 2 — offer
  one_line_description?: string;
  offer_description?: string;
  price_point_band?: string;

  // Step 3 — audience
  primary_audience_description?: string;
  audience_age_range?: string;
  audience_location?: string;
  audience_belief?: string;
  audience_belief_target?: string;

  // Step 4 — brand
  logo_uploaded_yes_no?: 'yes' | 'no';
  brand_colours?: string;
  instagram_handle?: string;

  // Step 5 — photos
  photo_count?: number;
  photo_consent_yes_no?: 'yes' | 'no';

  // Step 6 — voice
  stated_voice?: string;
  reference_posts_block?: string;
  customer_backstory_verbatim?: string;

  // Step 7 — counts (echoed for prompt fidelity per v2.ts)
  video_count?: number;
  carousel_count?: number;
}

interface FormResponsesPanelProps {
  formPayload: FormPayload | null;
  customerName: string | null;
  customerEmail: string | null;
  brandName: string | null;
  photoCount: number;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function FormResponsesPanel({
  formPayload,
  customerName,
  customerEmail,
  brandName,
  photoCount,
}: FormResponsesPanelProps) {
  const fp = formPayload ?? {};
  const nicheDisplay = fp.niche_label || fp.niche_slug;
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <Section title="Business">
        <dl>
          <Field label="Brand" value={brandName} />
          <Field label="Niche" value={nicheDisplay} />
          <Field label="Owner" value={fp.owner_name || customerName} />
          <Field label="Email" value={fp.email || customerEmail} />
          <Field label="Phone" value={fp.phone_e164} />
          <Field label="Instagram" value={fp.instagram_handle} />
        </dl>
      </Section>
      <Section title="Offer">
        <dl>
          <Field
            label="One-liner"
            value={
              fp.one_line_description ? (
                <p className="whitespace-pre-line">{fp.one_line_description}</p>
              ) : null
            }
          />
          <Field
            label="Offer detail"
            value={
              fp.offer_description ? (
                <p className="whitespace-pre-line">{fp.offer_description}</p>
              ) : null
            }
          />
          <Field label="Price band" value={fp.price_point_band} />
        </dl>
      </Section>
      <Section title="Audience">
        <dl>
          <Field
            label="Primary audience"
            value={
              fp.primary_audience_description ? (
                <p className="whitespace-pre-line">{fp.primary_audience_description}</p>
              ) : null
            }
          />
          <Field label="Age range" value={fp.audience_age_range} />
          <Field label="Location" value={fp.audience_location} />
          <Field
            label="Current belief"
            value={
              fp.audience_belief ? (
                <p className="whitespace-pre-line">{fp.audience_belief}</p>
              ) : null
            }
          />
          <Field
            label="Target belief"
            value={
              fp.audience_belief_target ? (
                <p className="whitespace-pre-line">{fp.audience_belief_target}</p>
              ) : null
            }
          />
        </dl>
      </Section>
      <Section title="Brand voice">
        <dl>
          <Field
            label="Stated voice"
            value={
              fp.stated_voice ? (
                <p className="whitespace-pre-line">{fp.stated_voice}</p>
              ) : null
            }
          />
          <Field
            label="References"
            value={
              fp.reference_posts_block ? (
                <p className="whitespace-pre-line text-xs">{fp.reference_posts_block}</p>
              ) : null
            }
          />
          <Field
            label="Backstory"
            value={
              fp.customer_backstory_verbatim ? (
                <p className="whitespace-pre-line">{fp.customer_backstory_verbatim}</p>
              ) : null
            }
          />
        </dl>
      </Section>
      <Section title="Visual character">
        <dl>
          <Field label="Brand colours" value={fp.brand_colours} />
          <Field label="Logo uploaded" value={fp.logo_uploaded_yes_no} />
        </dl>
      </Section>
      <Section title="Photos">
        <p className="text-sm">
          {photoCount} photo{photoCount === 1 ? '' : 's'} uploaded
          {fp.photo_consent_yes_no === 'yes' ? ' · consent given' : ''}.
          {photoCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              (Lightbox preview deferred to Phase 5.x.)
            </span>
          )}
        </p>
      </Section>
      <Section title="Order volume">
        <dl>
          <Field
            label="Videos"
            value={typeof fp.video_count === 'number' ? String(fp.video_count) : null}
          />
          <Field
            label="Carousels"
            value={typeof fp.carousel_count === 'number' ? String(fp.carousel_count) : null}
          />
        </dl>
      </Section>
    </div>
  );
}
