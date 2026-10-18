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
Once an available gift is displayed, choosing a box is required. The bottom
prompt is disabled until a successful open; there is no skip/close action and
Android Back cannot dismiss an unopened gift. Urgent dialogs still interrupt
the sheet. Unavailable/offline loading can return to the saved health result.
Opened receipts can be reviewed. Practice and read-only previews never claim.

The catalog is managed through protected backend operations endpoints. Health
tips need a recorded medical review before activation. Seed content consists of
60 original bilingual wishes. Recent fortunes are excluded for 30 calendar days.

Lucky draws are paused by default (zero ticket weight). The planned prize is
iPhone 18. After opening, the six-slot result marks exactly one received fortune.
The other five slots show labelled examples, including a phone image, with an
explicit explanation that they are illustrations rather than other outcomes of
the draw. They cannot be claimed and do not imply a missed winning box. Actual
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
