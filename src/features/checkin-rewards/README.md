# Daily check-in gifts (V2)

Production entry points use `checkin-gifts.api.ts` and `CheckinGiftFlow`.
After a saved check-in, the user chooses one of six illustrated boxes, then reads
the received fortune. Urgent health results stay visible until the user closes
them; urgent dialogs can interrupt the gift without overlapping native modals.
A call check-in offers its unopened gift on the next visit to Home. Home also
provides the current receipt, seven weekly dots, a streak and the fortune collection.

The authenticated backend decides and persists the fortune and optional ticket
at check-in time. Box selection never rerolls the result. One household/Vietnam
calendar day is enforced by the database, including concurrent requests and
multiple devices. Client storage and the device clock do not determine eligibility.
Once an available gift is displayed, choosing a box is required.
There is no skip/close action before a successful open and
Android Back cannot dismiss an unopened gift. Urgent dialogs still interrupt
the sheet. Unavailable/offline loading can return to the saved health result.
Opened receipts can be reviewed. Practice and read-only previews never claim.

Local animation testing can be enabled for one account through `.env.local`:
`EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_ACCOUNT_ID` and
`EXPO_PUBLIC_CHECKIN_GIFT_REPLAY_API_BASE_URL` (must match the configured API URL).
This requires both `__DEV__` and the `dev` app environment. The Home action uses
the most recent opened receipt to make local animation testing available, even
if there is no gift today. The tester chooses one of the same six boxes; the app
randomly draws a wish, proverb, tip, ticket or coupon sample, independently of the
box position. The phone is excluded from the draw (zero probability). There is no
gift-type selector. The sheet says it is a preview; ticket/coupon samples issue no
real draw entry or offer code. Samples never replace saved receipts, create check-ins, send
claims/notifications or change the daily quota. Other accounts and release builds
keep normal behavior.

The catalog is managed through protected backend operations endpoints. Health
tips need a recorded medical review before activation. Seed content consists of
60 original bilingual wishes and 20 traditional sayings. Twelve tip drafts stay
inactive until reviewed. Selection gives each eligible kind equal weight so the
larger wish catalog does not crowd out other kinds. Recent fortunes are excluded
for 30 calendar days. Store coupons remain disabled in production.

Lucky draws are paused by default (zero ticket weight). The planned prize is
iPhone 18 Pro Max. The gift sheet starts with six bundled Asinu mascot gift illustrations
in a 3-by-2 grid. There is no skip button, QR-code instruction or disabled footer
before a successful open.

The selected present moves into focus and opens. The result has the full fortune
in the upper section and the original six-slot grid directly below it. All five
remaining boxes open their lids and reveal their rewards together on one shared
1.1-second native animation, with no per-slot delay. The selected slot keeps
its received badge. There is no sequential reveal or separate row of rewards.
The existing preview catalogue never creates another award, ticket, coupon or claim.

The five-second countdown collapses only the upper fortune section. The complete
grid remains open until the user closes it, without a second automatic-close timer.
Queued or interrupted presentations do not count down behind another dialog.

Wishes, proverbs and tips are read in the upper result section only; their full
text is not repeated underneath the completed grid. Ticket and coupon details
remain available when the received gift needs rules or redemption information.

The fixed header and footer stay outside the scrolling body. Queued, interrupted,
unopened and read-only gifts do not count down. Local “Mở quà thử” remains enabled
for the already opted-in development account. Reduced Motion skips animation,
while keeping the upper fortune section and the five-second reading time.
Interrupting the shared opening completes its visual state so no box stays half-open.

Reduced Motion skips the sequence and shows the saved result immediately. Actual
ticket prize details still require a server-issued ticket or enabled draw period.
Opening a box never directly awards a phone. Activating a draw requires configured prize,
dates, bilingual rules and a registration reference. Rules and results are hidden
when the feature is off. Coupons and the 15-day trial remain deferred; gift code
neither changes entitlements nor invokes payments, wallets or store purchases.

`CheckinGiftDemoFlow` and `checkin-gift-demo.ts` remain separate development/preview
tools with local sample points. Their storage/quota is not used by production.
The development UI gallery and its demo route are temporarily hidden with
`isCheckinUiGalleryEnabled = false`; their preview code remains available to
restore later without changing production gifts.

Validation: `npm run test:checkin-gifts`, `npm run test:startup-modals`,
`npm run type-check`, `npm run test:api-contract` and the PostgreSQL integration
suite in backend.asinu. These are automated checks, not device visual approval.
