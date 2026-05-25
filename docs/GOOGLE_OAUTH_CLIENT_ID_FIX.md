# Sửa Google OAuth Client ID — chuyển sạch sang Google Cloud project chính chủ

> **TL;DR:** App đang lẫn 2 Google Cloud project — `726570048913` (của outsource cũ) và `416338225523` (chính chủ). **Toàn bộ phải về `416338225523`.** Hiện `.env` đã đúng, nhưng `app.json` và `eas.json` vẫn còn dùng client ID outsource → phải sửa 4 chỗ trước khi build production.

---

## 1. Tại sao phải sửa?

Mỗi OAuth client (`xxxxx.apps.googleusercontent.com`) thuộc về **một** Google Cloud project duy nhất. Project đó là người sở hữu:

- Quota OAuth requests
- OAuth consent screen + verification status
- Billing
- Quyền xóa / disable client

Hiện tại app đang trộn 2 project:

| Số đầu Client ID | Thuộc về ai | Hậu quả nếu để nguyên |
|---|---|---|
| `726570048913` | Outsource — bạn không có quyền truy cập | Outsource xóa OAuth client → app **chết toàn bộ flow đăng nhập Google**, người dùng không thể login |
| `416338225523` | **Bạn (chính chủ)** | Bạn control 100%, an toàn dài hạn |

Vì vậy: **đổi sạch sang `416338225523`** là việc bắt buộc trước khi submit lên store.

---

## 2. Hiện trạng — chỗ nào đúng / chỗ nào sai

```
asinu/
├── .env                       ✅ ĐÚNG  — đang dùng 416338225523
├── app.json                   ❌ SAI   — đang dùng 726570048913 (2 chỗ)
└── eas.json                   ❌ SAI   — đang dùng 726570048913 (6 chỗ, 2 môi trường)
```

### Vì sao `.env` đúng mà app vẫn lỗi khi build?

- Khi chạy `npm start` (local dev) → app đọc `.env` → OAuth gửi đi client ID `416338225523` ✅
- **NHƯNG** `app.json` chứa **URL scheme iOS** + **Android intent filter** đang dùng reverse của `726570048913` → khi Google callback về app, callback gõ vào URL scheme cũ → app không nhận được → trắng màn hình sau khi đăng nhập

- Khi build qua **EAS Build** (`eas build --profile preview` hoặc `production`) → EAS đọc env từ `eas.json` (**KHÔNG đọc `.env`**) → app build ra dùng client ID outsource → cùng vấn đề + nguy cơ outsource xóa client

→ Phải sửa cả `app.json` + `eas.json`.

---

## 3. Quy tắc OAuth deep link (để hiểu vì sao 2 chỗ phải khớp)

Google iOS / Android Sign-In dùng **reverse client ID** làm URL scheme / intent filter để nhận callback. Cụ thể:

| Platform | Client ID dạng | URL scheme / intent scheme dạng |
|---|---|---|
| iOS | `416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21.apps.googleusercontent.com` | `com.googleusercontent.apps.416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21` |
| Android | `416338225523-vs42boe39psg5k927thrhuq8doobb29h.apps.googleusercontent.com` | `com.googleusercontent.apps.416338225523-vs42boe39psg5k927thrhuq8doobb29h` |

Nguyên tắc: cắt bỏ phần `.apps.googleusercontent.com` rồi prefix `com.googleusercontent.apps.`.

Nếu URL scheme không khớp client ID → Google trả về callback URL mà app không listen được → đăng nhập "treo".

---

## 4. Mapping cụ thể từng dòng cần sửa

### File 1: `asinu/app.json`

#### Dòng 34 — iOS URL Scheme

**Hiện tại:**
```json
"urlSchemes": [
  "com.googleusercontent.apps.726570048913-oq7rk69ronarv55lucd7it29t8ti0c32"
]
```

**Sửa thành:**
```json
"urlSchemes": [
  "com.googleusercontent.apps.416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21"
]
```

#### Dòng 65 — Android Intent Filter

**Hiện tại:**
```json
"data": [
  {
    "scheme": "com.googleusercontent.apps.726570048913-0oj1afglacg0h4p77toi6kvr6buh46j8"
  }
]
```

**Sửa thành:**
```json
"data": [
  {
    "scheme": "com.googleusercontent.apps.416338225523-vs42boe39psg5k927thrhuq8doobb29h"
  }
]
```

---

### File 2: `asinu/eas.json`

Sửa **cả 2 block** — Preview (dòng 51-53) và Production (dòng 67-69). Mapping y hệt nhau.

**Hiện tại (cả 2 block):**
```json
"EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "726570048913-0oj1afglacg0h4p77toi6kvr6buh46j8.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "726570048913-oq7rk69ronarv55lucd7it29t8ti0c32.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "726570048913-atltseun4619ge72ba6itpiqc6hbjnr0.apps.googleusercontent.com",
```

**Sửa thành (cả 2 block):**
```json
"EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "416338225523-vs42boe39psg5k927thrhuq8doobb29h.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "416338225523-e095rh2637h6fto5ia0gvnn8faeq96fd.apps.googleusercontent.com",
```

> Cả 3 giá trị này giống hệt dòng 11-13 trong file `.env` — chỉ cần copy sang.

---

## 5. Bảng tổng hợp — 9 chỗ cần kiểm sau khi sửa

| File | Vị trí | Phải chứa |
|---|---|---|
| `.env` | Dòng 11 (IOS_CLIENT_ID) | `416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21.apps.googleusercontent.com` |
| `.env` | Dòng 12 (ANDROID_CLIENT_ID) | `416338225523-vs42boe39psg5k927thrhuq8doobb29h.apps.googleusercontent.com` |
| `.env` | Dòng 13 (WEB_CLIENT_ID) | `416338225523-e095rh2637h6fto5ia0gvnn8faeq96fd.apps.googleusercontent.com` |
| `app.json` | Dòng 34 (iOS urlSchemes) | `com.googleusercontent.apps.416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21` |
| `app.json` | Dòng 65 (Android intent scheme) | `com.googleusercontent.apps.416338225523-vs42boe39psg5k927thrhuq8doobb29h` |
| `eas.json` | Preview ANDROID | `416338225523-vs42boe39psg5k927thrhuq8doobb29h.apps.googleusercontent.com` |
| `eas.json` | Preview IOS | `416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21.apps.googleusercontent.com` |
| `eas.json` | Preview WEB | `416338225523-e095rh2637h6fto5ia0gvnn8faeq96fd.apps.googleusercontent.com` |
| `eas.json` | Production ANDROID/IOS/WEB | Giống hệt Preview |

Lệnh search nhanh để verify không còn ID cũ:

```bash
grep -rn "726570048913" asinu/   # phải trả về RỖNG
```

---

## 6. Kiểm tra lại Google Cloud Console (project `416338225523`)

Sau khi sửa code, vào https://console.cloud.google.com → chuyển sang project **`416338225523`** → menu **APIs & Services → Credentials**. Kiểm tra 3 OAuth client đã đúng cấu hình:

### 6.1 iOS OAuth client `416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21`

- **Application type:** iOS
- **Bundle ID:** `com.asinu.lite` (phải khớp `app.json` → `ios.bundleIdentifier`)

### 6.2 Android OAuth client `416338225523-vs42boe39psg5k927thrhuq8doobb29h`

- **Application type:** Android
- **Package name:** `com.asinu.lite` (phải khớp `app.json` → `android.package`)
- **SHA-1 certificate fingerprint:** phải khớp keystore Asinu dùng để ký APK/AAB
  - Lấy SHA-1 bằng `eas credentials --platform android` (chọn project) → in ra fingerprint
  - Hoặc Play Console → **Setup → App signing → App signing key certificate** → copy SHA-1
  - **Phải có ÍT NHẤT 1 SHA-1.** Thiếu hoặc sai → Google trả `invalid_client` lúc login

### 6.3 Web OAuth client `416338225523-e095rh2637h6fto5ia0gvnn8faeq96fd`

- **Application type:** Web application
- **Authorized JavaScript origins:** nếu app có web build, thêm `https://asinu.top`
- **Authorized redirect URIs:** nếu backend dùng cho server-side OAuth callback, thêm URL backend (vd `https://asinu.top/api/auth/google/callback`)

### 6.4 OAuth Consent Screen

- **Publishing status:** phải là **In production** (nếu Testing → chỉ tester thêm sẵn login được)
- **App name + Support email + Logo** đầy đủ
- **Scopes:** ít nhất `openid`, `email`, `profile`
- Nếu chuyển từ Testing → Production lần đầu, Google sẽ verify (mất 1-4 tuần với app yêu cầu sensitive scope, nhanh hơn nếu chỉ cần email/profile)

---

## 7. Test sau khi sửa

### 7.1 Local dev

```bash
cd asinu
npm start --clear
```

→ Đăng nhập bằng Google trên thiết bị thật → phải về app sau khi chọn Google account, KHÔNG được trắng màn hình.

### 7.2 Build preview qua EAS

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Cài file `.ipa` / `.apk` lên thiết bị test → thử login Google → phải về app thành công.

### 7.3 Nếu gặp lỗi

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| Trắng màn hình sau khi chọn Google account | URL scheme `app.json` chưa khớp client ID |
| `invalid_client` | Bundle ID / Package name / SHA-1 trên Cloud Console sai |
| `redirect_uri_mismatch` | Web client thiếu redirect URI cho backend |
| `access_blocked: This app's request is invalid` | OAuth Consent Screen chưa publish hoặc thiếu scope |

---

## 8. Sau khi sửa xong — checklist

- [ ] `grep -rn "726570048913" asinu/` trả về rỗng (không còn ID cũ)
- [ ] `app.json` URL scheme iOS = reverse iOS client ID mới
- [ ] `app.json` Android intent scheme = reverse Android client ID mới
- [ ] `eas.json` cả Preview + Production env = client ID mới (3 dòng x 2 môi trường)
- [ ] `.env` 3 dòng client ID mới (đã có sẵn)
- [ ] Bundle ID `com.asinu.lite` đã set trên iOS client Cloud Console
- [ ] Package name `com.asinu.lite` + SHA-1 đã set trên Android client Cloud Console
- [ ] OAuth Consent Screen ở trạng thái **In production**
- [ ] `npx expo prebuild --clean` để regen `ios/` + `android/` với scheme mới
- [ ] Test login Google trên dev build → OK
- [ ] Test login Google trên EAS preview build → OK

Sau khi pass hết, an toàn để build production và submit store.

---

## 9. Câu hỏi thường gặp

**Q: Có cần thông báo Google Cloud project cũ (`726570048913`) là sẽ ngừng dùng không?**
A: Không. Outsource muốn xóa OAuth client của họ thì cứ xóa — sau khi anh đã chuyển hết sang `416338225523`, app không còn phụ thuộc project cũ nữa.

**Q: User đã đăng nhập trước đây bằng project cũ, đổi sang project mới có ảnh hưởng tài khoản họ?**
A: Không ảnh hưởng. Google OAuth chỉ dùng để xác thực `email` của user. Email không đổi → backend Asinu vẫn nhận diện đúng user qua email. Họ chỉ phải bấm "Đồng ý" lần đầu khi login với app mới (vì project mới là app khác trong mắt Google).

**Q: Có cần re-verify app trên Google không?**
A: Nếu OAuth Consent Screen của project `416338225523` chưa publish → cần publish + có thể phải verify (chỉ cần `email`, `profile` thì verify rất nhanh, không yêu cầu video demo).

**Q: Web client ID có cần nếu app chỉ chạy mobile?**
A: Có. Expo `expo-auth-session` cho Google dùng Web client ID làm `expoClientId` ở một số flow. Giữ cả 3 (iOS + Android + Web) trong cùng project là đúng best practice.
