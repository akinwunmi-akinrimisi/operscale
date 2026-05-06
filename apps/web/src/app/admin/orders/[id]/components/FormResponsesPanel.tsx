interface FormPayload {
  brand_name?: string;
  niche?: string;
  website?: string;
  description?: string;
  customer_whatsapp?: string;
  customer_email?: string;
  angles_selected?: string[];
  goal?: string;
  topics?: string[];
  things_to_avoid?: string[];
  posting_platforms?: string[];
  tone?: string;
  reference_posts?: string[];
  brand_colors?: string[];
  on_camera?: string;
  setting_vibe?: string;
  niche_followups?: Record<string, string>;
  source_attribution?: string;
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
    <div className="grid grid-cols-[120px_1fr] gap-2 py-0.5">
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
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <Section title="Business">
        <dl>
          <Field label="Brand" value={brandName} />
          <Field label="Niche" value={fp.niche} />
          <Field label="Website" value={fp.website} />
          <Field
            label="Description"
            value={fp.description ? <p className="whitespace-pre-line">{fp.description}</p> : null}
          />
          <Field label="Customer" value={customerName} />
          <Field label="Email" value={customerEmail} />
          <Field label="WhatsApp" value={fp.customer_whatsapp} />
        </dl>
      </Section>
      <Section title="Direction & goals">
        <dl>
          <Field label="Angles" value={fp.angles_selected?.join(', ')} />
          <Field label="Goal" value={fp.goal} />
          <Field label="Topics" value={fp.topics?.join(', ')} />
          <Field label="Avoid" value={fp.things_to_avoid?.join(', ')} />
          <Field label="Platforms" value={fp.posting_platforms?.join(', ')} />
        </dl>
      </Section>
      <Section title="Brand voice">
        <dl>
          <Field label="Tone" value={fp.tone} />
          <Field
            label="References"
            value={
              fp.reference_posts?.length ? (
                <ul className="list-disc pl-4 text-xs">
                  {fp.reference_posts.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : null
            }
          />
          <Field
            label="Colors"
            value={
              fp.brand_colors?.length ? (
                <span className="flex flex-wrap gap-1">
                  {fp.brand_colors.map((c, i) => (
                    <span
                      key={i}
                      className="inline-block rounded border px-1.5 py-0.5 text-xs"
                      style={{ background: c }}
                    >
                      {c}
                    </span>
                  ))}
                </span>
              ) : null
            }
          />
        </dl>
      </Section>
      <Section title="Visual character">
        <dl>
          <Field label="On camera" value={fp.on_camera} />
          <Field label="Setting" value={fp.setting_vibe} />
        </dl>
      </Section>
      <Section title="Photos">
        <p className="text-sm">
          {photoCount} photo{photoCount === 1 ? '' : 's'} uploaded.
          {photoCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              (Lightbox preview deferred to Phase 5.x.)
            </span>
          )}
        </p>
      </Section>
      {fp.niche_followups && Object.keys(fp.niche_followups).length > 0 && (
        <Section title="Niche follow-ups">
          <dl>
            {Object.entries(fp.niche_followups).map(([k, v]) => (
              <Field key={k} label={k} value={v} />
            ))}
          </dl>
        </Section>
      )}
      <Section title="Source">
        <dl>
          <Field label="Heard via" value={fp.source_attribution} />
        </dl>
      </Section>
    </div>
  );
}
