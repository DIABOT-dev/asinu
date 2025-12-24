SUMMARY - Directive 027 (Legal modal + mandatory checkbox)
- Removed corrupted comment text from src/styles/theme.ts to fix mojibake fonts.
- Added local legal copy in src/constants/LegalText.ts (terms + privacy).
- Added in-app legal modal screen with ScrollView in app/legal/content.tsx.
- Wired legal modal presentation + "Dong" header button in app/_layout.tsx.
- Register screen: mandatory checkbox, opens legal modal, and disables "Dang ky" until agreed in app/register/index.tsx.
- Terms/Privacy links now open the in-app modal in app/login/index.tsx, app/login/phone.tsx, app/login/email.tsx, app/settings/index.tsx, and app/(tabs)/profile/index.tsx.
