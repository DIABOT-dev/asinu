# Build mobile có IAP

## Development iOS

```bash
npm ci
npx eas-cli@24.8.0 build --platform ios --profile development
npx expo start --dev-client
```

## Production

```bash
npx eas-cli@24.8.0 build --platform all --profile production
npx eas-cli@24.8.0 submit --platform ios --latest
```

Trước khi build:

- `EXPO_PUBLIC_PAYMENT_METHOD=iap`.
- API URL trỏ đúng môi trường.
- App Store/Play Console đã activate sáu SKU An Tâm 2/4/8.
- File và Key ID trong `eas.json` thuộc cùng App Store Connect API key còn hiệu lực.
- Backend production đã có Apple Root CA, Google service account và chỉ nhận receipt production.

TestFlight dùng sandbox; không dùng profile production trỏ `asinu.top` để kiểm thử mua hàng.
