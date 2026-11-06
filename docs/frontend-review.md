# Frontend review

## Repository map

- `frontend/app`: public homepage, campaign detail, public ledger, demo sign-in, and separate donor, organizer, vendor, and verifier workspaces.
- `frontend/components`: campaign browsing, role dashboards, existing creation/upload/review forms, Sandbox checkout, progress indicators, and AG Grid ledger.
- `frontend/lib`: typed FastAPI client, mock records, presentation helpers, and demo session state.
- `backend`: FastAPI, database models, invoice extraction, advisory AI, deterministic policy checks, audit records, and PayPal installment payouts. Backend business logic was not changed.
- `docs` and `sample_invoices`: submission documentation and synthetic invoice placeholders. The listed sample invoice files are not yet supplied.
- Root configuration: Docker Compose, setup instructions, environment examples, and product specification.

## Theme: A brighter corner of the community

Retains the Petal palette: pale pink, warm ivory, deep rose, and plum neutrals. Shared colors remain in `frontend/app/globals.css` under `@theme`. Georgia headlines add an expressive editorial voice; Arial body text stays simple and readable. Cards use opaque warm surfaces. Glass is reserved for navigation, the sign-in panel, and photographic overlays. Image entrances, button feedback, and subtle background movement respect reduced-motion preferences. Keyboard focus, skip links, touch sizes, forced-color styles, and reduced-transparency support remain available.

Library photography is now limited to library campaign cards and detail pages. The public hero and sign-in page use general volunteering imagery, and their copy speaks to community giving rather than one project. A decorative heart and giving badge animate briefly (4.8 seconds), then settle; reduced-motion preferences disable them. Campaign-photo hover feedback is limited to devices with a hover pointer.

The [illustrative library photograph](https://images.unsplash.com/photo-1507842217343-583bb7270b66) is downloaded from Unsplash and served locally as `frontend/public/images/library.jpg`. It is labeled as illustrative and is never presented as project delivery evidence. Homepage photo: [volunteers carrying supplies](https://images.unsplash.com/photo-1593113598332-cd288d649433), saved as `community-volunteers.jpg`. Sign-in photo: [a community-event volunteer](https://images.unsplash.com/photo-1559027615-cd4628902d4a), saved as `community-event.jpg`. Both are illustrative stock photographs, not StraightMoney delivery records. No donor counts or testimonials were invented.

## Public journey

`/` introduces the library project and explains invoice review and direct vendor payouts. Explore campaigns loads current API records (or explicitly marked mock records), links to `/campaigns/[campaignId]`, shows funding progress, and links directly to each campaign's public ledger. Drafts are omitted from public exploration.

Campaign detail contains the description, available funds, completed payouts, budget/vendor breakdown, donation form, follow action, FAQs, and progress updates. Donations do not require sign-in. Draft and closed campaigns do not expose checkout. Invalid demo campaign IDs no longer silently show the seeded campaign.

Project updates use recorded invoice descriptions, review states, payment states, and uploaded evidence when available. Empty/error states are explicit. Submitted evidence is not treated as proof of approval or payment. Mock records do not substitute stock photos for missing delivery evidence.

## Sign-in and role journeys

The normal navigation has no role dropdown. Demo sign-in offers four described roles and an optional display name. After selection, the account menu displays the name, role, dashboard link, and sign-out. Each role routes to a different workspace; selecting another workspace prompts for the corresponding demo role.

- **Donor `/donor`:** supported/followed campaigns and this tab's captured Sandbox/simulated donations. Follow links lead to project updates; spending links lead to the ledger. Mock checkout previews do not create receipts.
- **Organizer `/organizer`:** campaign funding, assigned budgets/vendors, invoice progress, and a creation flow that defines budget lines and vendor assignments. Creation remains available with no existing campaigns.
- **Vendor `/vendor`:** select a demo assignment, inspect its work and invoice amounts, upload an invoice and proof, and track review, paid amounts, and amounts still owed.
- **Verifier `/verifier`:** pending-review queue first, evidence/check review, approval/rejection, payment queues, and the last recorded decision outcome. Re-fetching a queue with the same selected invoice no longer leaves detail loading indefinitely.

Review and payment are separate on invoice cards and in the verifier outcome. Approved invoices can be awaiting funds, awaiting PayPal confirmation, partially paid, or failed. None of those labels claims a completed payout. Backend approval/payment behavior is unchanged.

## Demo boundaries

This is not real authentication or authorization. The API has no per-user roles, ownership filters, or private donor history endpoint. Workspaces explicitly identify shared Sandbox data. Vendor selection is a demo assignment selector, not proof of identity. The client-side role presentation does not protect API routes.

Display name, role, follows, and captured donation confirmations live in session storage for the current browser tab. Sign-out clears them; a new demo sign-in starts fresh. Payment capture succeeds independently of browser receipt storage. A failed refresh after a successful capture explains that the donation was captured and directs the user to the ledger before another attempt.

Before real authentication, backend identity must determine roles and permitted campaigns/invoices. Organizer, vendor, and verifier access must come from assignments or invitations, not an unrestricted role field. Private donor history must come from authenticated server records.

## Verification

- Production build and ESLint passed. All nine state regression tests passed.
- `npm run test:ui` runs Node regression tests covering role destinations, cumulative funding after payouts, review/payment separation, partial and rejected states, follow toggling, receipt capture/deduplication, and validation of stored demo state. The native TypeScript test loader requires Node 22.6+; Node 26 was used here.
- HTTP smoke checks returned 200 for the public homepage, sign-in, all four role routes, campaign detail, and ledger. Each had a main-content skip target; the library photo served as a JPEG.
- Visual/browser interaction checks could not run because access to Chrome was not approved. HTTP and state tests do not certify layout quality or WCAG conformance. No Sandbox payment, payout, invoice upload, or campaign mutation was executed during this review.

## Browser checklist before presenting

1. At desktop width and 375px, inspect the hero/photo, navigation wrapping, campaign cards, dashboard controls, and sign-in roles. Test 200% zoom.
2. Tab through the skip link and controls. Check visible focus, accordion operation, screen-reader labels, and reduced-motion behavior.
3. Browse a campaign and ledger anonymously. Check donation presets, invalid amounts, disabled editing during capture, and closed/draft behavior.
4. Sign in to each demo role. Verify its dashboard destination, account menu, and sign-out. Check that choosing a new role clears the prior tab's follows/history.
5. As donor, follow/unfollow a campaign. Verify empty history and that mock donation previews do not become captured donations.
6. As organizer, inspect funding and invoice states, then preview creation. As vendor, switch assignments and confirm only that vendor's work and invoices appear.
7. As verifier, switch pending/payment/all filters, reselect the current invoice, and refresh the queue. With a configured Sandbox backend, confirm a decision leaves an explicit review/payment outcome even when the invoice leaves the pending queue.
8. With Sandbox configured, test capture, cancellation, capture failure, and refresh failure separately. Confirm history records only successful captures and labels simulated captures accurately.

## Homepage highlights and purpose

The homepage now includes an `our-impact` section before the funds journey: three illustrated highlights cover donor clarity, human review, and visible progress. A wider purpose panel explains intended benefits for communities, donors, and vendors, and links to campaign exploration. It describes the impact the Sandbox prototype is working toward without inventing beneficiary counts, donation totals, or completed outcomes. Cards use the Petal palette and restrained hover feedback that respects reduced motion.

## Public copy cleanup

Removed hackathon/demo framing from the homepage impact note, footer, campaign section labels, account menu, and workspace headings. Sign-in now describes workspace selection and its current browser session without implementation guidance. Sample records and payment previews retain accurate labels; Sandbox and simulated payment outcomes remain explicit in transaction controls/history. This copy update does not enable real authentication or live payments.

## Impact photography

Added three locally served Unsplash photographs to the homepage highlights: [giving](https://images.unsplash.com/photo-1532629345422-7515f3d16bb6), [community participation](https://images.unsplash.com/photo-1469571486292-0ba58a3f068b), and [human connection](https://images.unsplash.com/photo-1544027993-37dbfe43562a). Each photo has descriptive alternative text, responsive image sizing, and a reserved aspect ratio. The section identifies this imagery as illustrative; campaign evidence remains separate. Library images remain within library campaigns.

## Interactive impact toggles

The hero now uses `ImpactExperience`: Give, Follow, and Grow buttons select a photo and a short impact story. Images, shading, the vector badge, motion control, and glass caption are separate visual layers. Opacity, transforms, colors, and shadow properties interpolate during selection changes. A requestAnimationFrame spline interpolates matching vector control points to morph a heart into a shield and bloom; rapid changes continue from the current shape.

Selections are user-driven. The panel has an explicit motion switch, follows system reduced-motion preferences, cancels animation on cleanup, announces the selected story politely, and exposes pressed states on keyboard-operable buttons. Reduced motion keeps all three selections usable with instant transitions. No financial or project records are changed by these visual controls.

Two additional regression tests verify interpolation endpoints/clamping and finite closed paths with compatible topology, bringing `npm run test:ui` to 11 passing checks. Browser interaction and visual checks remain unverified because Chrome access was not approved earlier in the session.

## Site-wide tactile motion and varied photography

`SiteMotion` wraps all application routes. Shared pointer and keyboard handlers shrink controls toward 95% on press and use a sampled damped spring to overshoot gently and settle on release. Selected toggle backgrounds use a blue activation accent within the existing pink theme; activated glyphs pulse. Browser Web Animations provide the web equivalent of the requested native iOS spring behavior. Native click, form, disclosure, and keyboard actions remain intact. AG Grid's internal controls and external payment frames are excluded from the delegated effects.

The header and hero motion controls share one setting across client-side navigation. Turning it off cancels managed animations, disables CSS transitions/animations and background movement, and reveals pending content immediately. System reduced-motion preferences take precedence. An IntersectionObserver reveals off-screen sections/cards; dynamically loaded content is registered through a MutationObserver, and keyboard focus reveals content immediately. All observers and animations are cleaned up.

Hero selections now use three distinct images: giving uses the original volunteer photograph, Follow uses [project planning](https://images.unsplash.com/photo-1517048676732-d65bc937f952), and Grow uses [gardening supplies](https://images.unsplash.com/photo-1416879595882-3373a0480b5b). These replace hero reuse of the impact-card images. The library detail page uses a separate [stack of books](https://images.unsplash.com/photo-1497633762265-9d179a990aa6) from its campaign-card photograph. No stock image is presented as delivery evidence.

Regression coverage now includes release overshoot/settling, interrupted-press scale origins, spring vector interpolation, and different card/detail imagery. Browser visual and interaction verification remains pending because Chrome access was not approved earlier.

## Effect visibility adjustment

Quick taps now finish a short compression phase before the spring release, so immediate clicks do not reduce the feedback to an almost invisible scale change. The hero includes an instruction beside its scene selectors. When the device requests reduced motion, controls explicitly read “Motion reduced” and explain why transitions are instant. Regression coverage includes the quick-tap keyframes (14 tests total).

## Automatic slideshow and rose controls

The hero now advances through Give, Follow, and Grow automatically every six seconds while visible. Hovering or focusing its content pauses rotation; an unobtrusive slideshow pause/play control allows an explicit pause. Background tabs and off-screen slides do not advance. System reduced-motion preferences disable autoplay and animated transitions. Automatic changes do not repeatedly announce their text through the live region.

Removed both motion-setting buttons and their manual state. Website effects now follow the device preference directly. Blue activation accents were replaced with the existing rose/pink palette throughout the shared controls and vector badge.

## Main goal and distinctive approach

Added an `our-idea` section immediately after the hero to explain the central goal: help communities fund meaningful projects while making the spending visible to supporters. Four concrete product distinctions cover published budgets, evidence-backed invoice review, registered vendor payouts, and a public ledger. Copy describes StraightMoney's own workflow without unsupported claims about other fundraising services. The section links directly to campaign exploration and follows the existing responsive Petal design and shared reveal behavior.

## Cursive headings, Jakarta Sans, and mission photography

Large display headings now use Allura cursive. Plus Jakarta Sans is used for body copy, controls, navigation, and the ledger grid. Both fonts are self-hosted through `next/font/local`; original font files and SIL Open Font License notices are in `frontend/app/fonts`, downloaded from the Google Fonts repository. Display spacing was relaxed for connected script, and functional text retains the sans-serif treatment.

The Our Idea section adds a staggered, responsive two-photo story: [community connection](https://images.unsplash.com/photo-1511632765486-a01980e01a18) and [partnership](https://images.unsplash.com/photo-1521791136064-7986c2920216). Images have descriptive alternative text and are identified as illustrative. They are distinct from the hero, impact-card, and library campaign photographs.

## Refined font pairing

Replaced decorative Allura cursive with locally hosted Lora, a readable editorial serif, for display headings, the logo mark, and step numbers. Plus Jakarta Sans remains on body text, navigation, controls, and tables. Headline weight, tracking, and spacing were adjusted for the serif; script-specific small-heading sizing was removed. Allura is no longer loaded. Lora's source and license are retained under `frontend/app/fonts`.

Headings now use Lora's true italic face for a subtle flowing style. Body and interface text remain Plus Jakarta Sans; the earlier decorative script remains unloaded.

## Clearer impact stories

Redesigned the impact section as one large image-and-copy feature followed by two roomy photo cards. Titles use upright bold Jakarta Sans for scanning, while the section heading keeps the softly italic editorial font. Paragraphs are shorter, body copy is larger and darker, and each story has a two-item visual checklist. A concise summary replaces the denser role-benefit panel. Layouts stack on smaller screens; existing imagery remains illustrative.

## Mission as a visual flow

Restored the original Our Idea heading, explanation, and four differentiator descriptions. Replaced the dense side panel with numbered Plan → Review → Pay → Follow cards, each with a distinct icon and connector arrow. Desktop uses a horizontal flow, tablet uses two rows, and mobile uses a vertical sequence with downward arrows. Community photos sit beside the introduction in a staggered composition. Content is an ordered list with decorative connectors hidden from assistive technology.

## Funds journey timeline

Replaced the four plain columns in “Care in every step” with a connected vertical timeline. Numbered nodes, distinct icons, and role labels make the donor → vendor → verifier → payment flow easier to scan. The introduction stays alongside the timeline on larger screens and stacks above it on mobile. A separate visual callout distinguishes approval (review decision) from paid (confirmed transfer), including possible waits for funds or confirmation. The original four step titles and explanations remain intact.

## Story-link scroll correction

“Read the story” now targets the campaign's permanent `campaign-story` anchor. Campaign detail resolves the destination after its API-loaded content mounts, preventing retained homepage scroll from opening the story near the bottom. Donation and update anchors are handled at the same point so their targets are available before scrolling. Story entry remains separate from the donation form link.

## Separate exploration and donation destinations

Global Explore campaigns continues to point to the homepage campaign list. Global Donate now opens `/donate`, a focused page with an active-campaign selector and contribution form. On campaign detail, Donate continues to point directly to that campaign's form. The new page includes story/ledger links, loading/error/empty states, and a campaign-specific progress link after capture. Payment creation/capture behavior is unchanged.

## Ocean Blue theme

Changed the shared palette from pink/plum to a PayPal-inspired light-blue and navy direction. Surfaces and overlays use cool whites and pale blues, primary actions use a readable deep blue, and decorative accents use a brighter cyan blue. Text, borders, shadows, gradients, selected controls, timeline nodes, and the AG Grid theme were updated together. Existing Lora Italic/Plus Jakarta Sans typography and motion behavior remain unchanged. Error and warning colors retain their semantic roles.

Key text pairs passed contrast checks: white on the primary button 6.66:1, body text on the main surface 6.43:1, muted text on white 5.03:1, and navy links on light blue 10.39:1. The theme is identified as `ocean-blue` on the root element.

## Harbor Blue refinement

Softened the blue theme into a distinct StraightMoney palette: misty blue and cloud-white surfaces, muted denim actions, and slate-navy text. Saturated PayPal-like blue values were replaced throughout tokens, overlays, gradients, shadows, and the ledger theme. Fonts, layouts, and interactions remain unchanged. Primary action, body, and muted-text contrast checks pass 4.5:1.
