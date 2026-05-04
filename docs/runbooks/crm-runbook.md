# CRM runbook

**Status:** Authoritative for Phase 1.
**Owner:** Akinwunmi (operator) and Claude Code (build/maintenance).
**Last updated:** 2026-05-03.

This is the operator's guide for using the internal CRM day-to-day. It's written for the person actually clicking the buttons, not the person writing the code that builds them. Sequential. No skipped steps.

If you're confused about something while using the CRM, start here. If the doc doesn't have your answer, that's a doc bug — flag it.

## 1. What the CRM is

A single internal Next.js admin app at `/admin/*` on the same domain as the marketing site. Magic-link authenticated. Only allowlisted emails can log in.

Three primary surfaces:

1. **Pending Review queue** — the work surface. New briefs land here.
2. **Order Detail (review mode)** — the per-brief review and approval screen.
3. **Order Detail (timeline mode)** — the post-payment per-order chronological feed.

Plus secondary lists: Inbox, Awaiting payment, Paid, Production, Delivered, Refunded, Drop-offs.

## 2. Logging in

Go to `https://operscale.cloud/admin`. Enter the founder email. Click the magic link in your inbox. Session lasts 12 hours of inactivity, then re-auth.

**If the magic link doesn't arrive:** Check spam. Wait 60 seconds. If still nothing, check the Resend dashboard for delivery status. If delivery shows but inbox doesn't have it, your email provider is filtering it — add `auth@operscale.cloud` to your contacts.

**If you click the link and get "session expired":** The link is single-use and expires in 10 minutes. Request a new one.

## 3. Daily routine

Two checkpoints daily, ideally:

- **Morning (08:00-09:00 WAT)**: Clear overnight Pending Review queue. Anything submitted late evening should leave the queue before 9 AM (this is what we promised in the auto-ack).
- **Afternoon (14:00-15:00 WAT)**: Clear midday submissions. Glance at Awaiting Payment to see which briefs are sitting and whether anything needs a manual nudge.

Plus: WhatsApp alert response when the system pings you about an over-2h pending review.

The whole routine is roughly 30-60 minutes daily at 5-15 orders/day. Above that, you're hiring a reviewer.

## 4. The Pending Review queue

URL: `/admin/pending-review`.

### 4.1 What you see

A list of briefs awaiting your review. Each row:

- **Customer name and business** — at a glance, who this is for.
- **Niche** — pill, colour-coded.
- **Tier** — Starter / Standard / Calendar.
- **Submitted at** — relative time ("12 minutes ago", "1h 47m ago").
- **Time-since-submission badge** — green ≤30 min, yellow 30-120 min, red >120 min.
- **Photo indicator** — small camera icon if photos uploaded, with the count.
- **Restricted-niche flag** — orange triangle if the AI analysis flagged anything.

Sorted oldest first. **Always handle the oldest first.** Even if a newer one looks more interesting.

### 4.2 What "good" looks like

- All rows green or yellow. Nothing red.
- Median time from submission to approval under 5 minutes once the queue is hot.
- Re-analyze rate under 25% (if you're hitting "re-analyze with note" on every fourth brief, the prompt needs work).

### 4.3 When you're not sure whether to approve, edit, or re-analyze

Use this decision tree:

- **Brief summary captures what the customer said?**
  - No → Re-analyze with note.
  - Yes → continue.
- **Three angles are actually three different angles, not three rephrasings of one?**
  - No → Re-analyze with note.
  - Yes → continue.
- **Sample script seed reads naturally and matches the brand voice block?**
  - No, slightly off → Inline edit the offending lines.
  - No, fundamentally wrong → Re-analyze with note.
  - Yes → continue.
- **Brand voice block reflects the customer's reference posts?**
  - No → Inline edit (this is fast — paste a corrected do-say/do-not-say).
  - Yes → continue.
- **Visual style palette derives sensibly from customer brand colours?**
  - No → Inline edit the palette.
  - Yes → continue.
- **Upsell recommendation is justified by the brief?**
  - No → Inline edit `should_upsell` to false.
  - Yes → continue.
- **Photo aesthetic block (if photos uploaded) flags any quality issues you'd like the customer to know about?**
  - Yes → Inline edit to soften or remove the flag (we don't want to embarrass the customer in the brief email).
  - No → continue.

If you got through every step → click **Approve and send**. The brief email goes out immediately.

### 4.4 The review screen at a glance

When you click a brief from the queue, you land on the order detail page in **review mode**. Three columns:

- **Left: Form responses**. Everything the customer submitted. Photos as thumbnails — click to lightbox-zoom. Save token if they used resume. All seven steps visible without scrolling between them. Quality-check pills next to each photo.
- **Middle: AI analysis output**. Editable inline. Sections: Brief summary / Three angles / Sample script seed / Brand voice / Photo aesthetic / Visual style / Upsell recommendation / Flags.
- **Right: Action panel**. Three buttons stacked: Approve and send (primary, blue), Re-analyze with note (secondary, opens a textarea modal), Discard (tertiary, opens a confirmation modal).

## 5. Inline editing

Every text field in the AI analysis output is click-to-edit. No edit mode toggle.

### 5.1 How it works

- Click the text. It becomes a textarea or input.
- Edit.
- Click outside the field, or press Escape, or press Tab. Save fires on blur.
- A small "edited" badge appears next to the field for the rest of the session.
- Each edit creates an `analysis_edits` row with field path, before, after, and your email.

### 5.2 What to edit vs what to re-analyze

Inline edit is for **small fixes**:
- Typo or grammatical fix.
- Tightening a sentence.
- Swapping a word that doesn't fit the brand voice ("synergize" → "work with").
- Toning down a flag that feels too harsh.
- Fixing a palette hex code.

Re-analyze with note is for **structural problems**:
- The three angles aren't actually different.
- The brief summary missed the customer's main point.
- The brand voice block is reading from a wrong tone selection.
- The upsell recommendation doesn't make sense.
- The sample script seed misses the customer's product entirely.

Rule of thumb: if you're rewriting more than two or three sentences, you should be re-analyzing.

### 5.3 What gets lost on re-analyze

When you click re-analyze, the current analysis becomes archived and a new one replaces it. All your inline edits to the previous version are preserved in `analysis_edits` for audit, but they're not carried into the new analysis. So:

- Don't spend 10 minutes inline-editing then click re-analyze. The edits won't matter.
- If you can tell early that you'll re-analyze, do it first. Then inline-edit the new output.

## 6. Re-analyze with note

Click the "Re-analyze with note" button on the right panel. A modal opens with a textarea.

### 6.1 Writing a good note

The note appends to the AI prompt. Be specific. Examples:

**Good:**
> Customer mentioned launching in 2 weeks — I want the calendar to lean toward urgency and educational hooks, not slow brand-building. The current angles all read like Year-1 brand foundation; I want Week-1-launch energy. Pull from her reference posts where she's talking about timeline pressure.

**Also good:**
> Brief summary read like a different customer. Re-read step 2 description carefully — she's not selling skincare, she's selling skincare *consulting* services for other brand founders. Different audience, different angles.

**Bad:**
> Make it better.

**Also bad:**
> Try again.

The AI can't read your mind. Tell it what you want differently.

### 6.2 What happens after you submit the note

- The textarea closes.
- A spinner shows "Re-analyzing... typically 60-120 seconds."
- The middle column refreshes with the new analysis.
- The previous version is archived (visible via the "Show previous run" link at the bottom of the middle column).
- Each re-analysis costs ~$0.12 in API. Logged in `llm_calls`.

### 6.3 How many re-runs are reasonable

Phase 1 is tuning-friendly. Two or three re-runs on a single brief is fine. Five+ is a signal that:

- The form data is too thin for AI to work with (short business description, missing reference posts).
- The AI prompt has a blind spot you should report so we can iterate.
- This particular customer just needs to be written manually — go ahead and write the brief email yourself, then click "Discard" on the AI run and use the manual-email action button.

## 7. Approve and send

Click "Approve and send". Three things happen in a transaction:

- The current edited analysis becomes the approved one (`orders.approved_analysis_run_id` set).
- The brief email fires via Resend, with the Paystack payment link in the body.
- The order moves from `pending_founder_review` to `brief_sent`.

### 7.1 What the customer sees

Email subject: `Your Operscale calendar brief is ready — {{tier_name}}, {{video_count}} videos`.

Body in `docs/specs/email-templates.md`. Includes brief summary, three angles, sample script seed, visual direction preview (this is the one drawn from `visual_style.recommended_camera_treatment` — it's the customer's first concrete look at production aesthetic), pricing recap, payment CTA.

### 7.2 What you see

The order disappears from Pending Review. It now appears in **Awaiting Payment**.

### 7.3 If something goes wrong

If the brief email fails to send (rare — Resend is reliable), you'll get a banner: "Email failed to send. Click to retry." Click. If it fails twice, the order stays in `brief_sent` status but with an `email_failed` flag — you'll want to re-send manually from the order detail page (see section 9.2).

## 8. Discard

Click "Discard". A confirmation modal appears asking for a reason (free text, required, min 5 chars).

### 8.1 When to discard

- **Spam** — clearly fake submissions, gibberish business descriptions, throwaway emails.
- **Out-of-scope niche** — sex-related, gambling-related, pyramid scheme adjacent. Things we don't want to make content for.
- **Duplicate brief** — sometimes a customer submits twice; discard the duplicate.

### 8.2 What discarding does

- Order moves to `discarded` status.
- No further automated emails go out.
- The customer's auto-ack already went out, so they think we're working on it. We don't follow up — chasing every discarded brief creates more confusion than clarity.
- If the customer follows up by email asking what happened, you handle it manually then.

### 8.3 What discarding doesn't do

- Doesn't delete anything. The brief, photos, AI analysis all stay.
- Doesn't delete photos early. The 30-day no-order retention clock kicks in.
- Doesn't refund anything (no payment was taken).

## 9. Order Detail timeline mode

After payment is initiated (or attempted), the order detail page switches from review mode to **timeline mode**. URL is the same `/admin/orders/{id}`; the layout adapts based on the order's status.

### 9.1 What you see

A single chronological feed. Every event in the customer's journey. Each entry:

- Timestamp in WAT.
- Event type (form_submitted, ai_analysis_completed, founder_approved, brief_email_sent, payment_initiated, payment_succeeded, etc.).
- Actor (customer, founder, system, webhook).
- Click to expand for full payload (form data, AI output, edited fields, full email body, Paystack webhook payload).

The whole order is auditable from this single feed.

### 9.2 Action buttons in timeline mode

- **Re-send any email** — opens a modal showing the available templates (auto-ack, brief, payment confirmation, drop-off recovery). Pick one, confirm, send. Logged.
- **Send manual WhatsApp** — free-text message, sent through Evolution API. Use sparingly; mostly for "did you get a chance to look at the brief?" follow-ups.
- **View customer photos** — opens lightbox with full-resolution photo viewer.
- **Issue refund** — opens a walkthrough modal. See section 10.
- **Mark as production-ready** — manual override; rarely used (production is auto-triggered on payment).
- **Delete customer photos early** — emergency button; overrides the 90-day retention clock. Use only on customer compliance request.

## 10. Issuing a refund

Phase 1 refunds are manually executed in the Paystack dashboard. The CRM walks you through it.

### 10.1 Step-by-step

1. Open the order in CRM. Click "Issue refund."
2. The CRM modal shows the Paystack tx_ref and a copy button. Copy it.
3. Open the Paystack dashboard in a new tab. Navigate to Transactions. Search the tx_ref. Click into the transaction.
4. Click "Refund." Confirm in Paystack.
5. Return to the CRM modal. Enter the refund reason (free text, required). Click "Mark as refunded."
6. The order status changes to `refunded`. Refund-confirmation email fires automatically.

### 10.2 When to refund

- Customer requested it explicitly.
- Production hasn't started yet, customer changed their mind.
- We made a mistake (missed the brief, wrong tier delivered).

### 10.3 When NOT to refund

- Customer paid, we delivered, customer just doesn't like the result. Phase 1 doesn't have an iteration round in scope; if they want changes, that's a paid revision (manual quote — Phase 1 doesn't have revisions productised).
- Customer paid more than 7 days ago. Beyond 7 days, refund is at founder discretion and usually requires manual back-and-forth.

### 10.4 What refunding does to retention

The 90-day photo retention clock starts at `delivered_at`. If refunded before delivery, photos move to `now() + 30 days` and will be swept then.

If refunded post-delivery, the 90-day clock continues from the original `delivered_at`. The customer's data isn't deleted just because they refunded — that requires a separate NDPC deletion request.

## 11. Drop-off recovery

The CRM has a Drop-offs view at `/admin/drop-offs`. It surfaces customers in three categories:

- **Form abandoned at step 3+** — the system has already auto-fired a save-link email. You don't usually need to act here.
- **Brief sent, no payment after 6h** — the system has auto-fired a recovery email. If they're still not paying after 24h, consider a manual WhatsApp.
- **Payment initiated, not completed after 2h** — the system has auto-fired a WhatsApp. If they're stuck on a payment issue, manual outreach can save the order.

### 11.1 Manual WhatsApp script for stuck payments

> Hey {{first_name}}, saw you got partway through the payment. Anything I can help unstick? Some quick options if it's a card thing — Paystack accepts both Naira cards and bank-transfer-as-payment. Happy to walk you through it. — Akinwunmi

Use this. Don't be too formal. Customers respond to it.

### 11.2 What's NOT auto-handled

- **Customer replies to a brief email asking questions.** Resend captures inbound replies and surfaces them on the order timeline, but you reply via your personal email (which is the from-address on the brief email). Phase 1 doesn't have a reply-from-CRM feature.
- **Customer asks for a discount.** Manual decision. Default position: no discount in Phase 1, but if they're a high-LTV niche (real estate, premium fashion) and the discount unlocks the order, exercise judgment.

## 12. Common scenarios

### 12.1 "I just got a WhatsApp alert that a brief is over 2h pending — what do I do?"

Open the CRM. The Pending Review queue is sorted oldest-first; the alerted brief is at the top. Run it through the decision tree in section 4.3. Approve, edit, or re-analyze within the next 15-30 minutes.

### 12.2 "A customer just emailed asking about their brief — what do I do?"

Search the CRM for their email or business name. Open the order detail. The timeline shows their full state. Reply from your personal email with whatever they're asking about.

### 12.3 "The AI just hallucinated a fact about the customer's business"

Inline edit the offending line. Click "Approve and send." The customer never sees the hallucination.

If hallucinations are common across briefs (3+ in a single day), file an issue — the prompt needs work.

### 12.4 "I approved a brief but realised after sending that there's a typo"

The brief email is already out. You can't unsend. Two options:

- Reply to the customer from your personal email with a correction note. Don't make it dramatic.
- Wait. Customers rarely notice typos that you obsessed over.

### 12.5 "A customer is asking to delete their photos"

Open the order detail. Click "Delete customer photos early." Confirm. The retention sweep runs immediately for those photos. The activity log records it. Reply to the customer confirming.

### 12.6 "The CRM is showing 'connection lost' on a Realtime subscription"

Refresh the page. If it persists, the Supabase Realtime service may be having issues — check status.supabase.com. The CRM's data is fine; only the live updates are affected. You can still work; you'll just need to refresh manually for new items.

### 12.7 "A WhatsApp message I sent shows as 'failed' in the timeline"

Evolution API delivery sometimes fails on the first attempt. Click "Re-send" on the failed entry. If it fails twice, the customer's number may be wrong or unreachable on WhatsApp — fall back to email.

### 12.8 "I want to see what the brief email actually looked like that I sent"

Open the order detail in timeline mode. Find the `email_brief_sent` event. Click to expand. The full body snapshot is there.

## 13. Things to NOT do

- **Don't approve a brief without reading the AI output.** Even if it looks fine at a glance, the brand voice block or upsell recommendation might be wrong.
- **Don't edit a brief and then walk away.** Edits save on blur but the approve action is separate. If you walk away mid-edit, the brief stays in pending review with your edits applied but unapproved — and it ages into the red zone.
- **Don't use the CRM on shared computers.** Magic link sessions are 12 hours; if you log in on a friend's laptop and forget, that's a security incident.
- **Don't delete the auth allowlist row for yourself.** You'll lock yourself out. Only Akinwunmi has the database access to fix it, and if Akinwunmi locks himself out it's a recovery process.
- **Don't bypass the founder review for "easy" briefs.** Every brief gets reviewed. The day you skip review is the day a hallucination ships.

## 14. Performance expectations

**Median founder time per brief**: ≤5 minutes after a few weeks of use. ≤2 minutes once you're in a groove.

**Daily total time at 5-15 orders/day**: 30-90 minutes spread across two checkpoints.

**Daily total time at 30+ orders/day**: 2.5+ hours. Time to hire a reviewer.

**When the CRM should make you slower**: never. If a feature adds friction (e.g. modal opens slowly, action button doesn't respond), file it as a bug. Phase 1 CRM is supposed to be fast.

## 15. What the CRM is NOT

- Not a customer support tool. Replies happen in your personal email.
- Not a project management tool. Production tasks happen in Phase 2 tooling.
- Not an analytics dashboard. Cost monitoring lives in a separate `llm_calls` query view; revenue is in Paystack; engagement is on Cloudflare.
- Not multi-user (Phase 1). Future: reviewer role with limited permissions.
- Not mobile-optimised for full operations. Phone is fine for triage; iPad-landscape is the primary device for review work.

If you find yourself wishing the CRM did one of these things, that's a future product question. Phase 1 is deliberately scoped to "founder review and order management" — nothing more.
