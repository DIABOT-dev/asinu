# Check-in gift demo

This is a functional prototype with sample points, enabled in development and
preview builds. Production builds close the health result without showing it.
It never calls payment, wallet, subscription or reward-granting APIs.

After a saved, non-urgent check-in result, tapping Close stops result audio and
offers six gift boxes. Opening one saves a random prize of 10, 20, 30, 50, 75 or
100 demo points before showing success. High-risk and emergency results keep
their direct close action. Practice sessions and read-only result previews
cannot consume gift turns.

The development UI gallery has a separate **Try opening a gift box** entry at
the top. This opens an interactive demo without creating any health records.
The gift entry among the gallery's screen previews remains read-only.

One opening or explicit skip is allowed per account per Vietnam calendar day
(UTC+7). The X button dismisses the chooser without using the turn. Reopening
the interactive demo after a claim shows the same receipt. All entry points
share a serialized local storage service, preventing duplicate claims from
rapid taps or retries within the running app. The last receipt survives app
restarts and signing out; accounts have separate storage keys.

The quota is local to the device. Clearing app data or using another device can
reset it. Before granting real rewards, replace this service with an
authenticated backend claim, a unique account/day constraint and a real prize
catalog. No real financial balance or entitlement should be granted from this
demo service.

Validation: `node scripts/check-checkin-gifts.mjs`.
