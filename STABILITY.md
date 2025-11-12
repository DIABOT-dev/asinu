# DIABOT V4 - Stability Blueprint

## 🎯 Mục tiêu

Chuyển từ "fix-by-symptom" sang hệ thống hóa độ ổn định để tránh vòng lặp chắp vá.

## 📋 Chính sách SSR/SSG

### Quy ước trang:

- **Trang có API browser** (Blob, window, localStorage, WebAudio...): 
  - ✅ Tách Client Component 
  - ✅ `export const dynamic = 'force-dynamic'`

- **Trang dữ liệu cá nhân/biến động** (dashboard, profile):
  - ✅ Mặc định dynamic
  - ✅ `revalidate = 0`

- **Trang marketing/static**: 
  - ✅ Mới SSG

### Checklist Review Bắt buộc:
- [ ] Không browser API trong Server Component
- [ ] Client Component có `'use client'` directive
- [ ] Dynamic pages có `export const dynamic = 'force-dynamic'`

## 🛡️ Guardrails

### ESLint Rules:
```json
{
  "no-irregular-whitespace": "error",
  "@typescript-eslint/no-explicit-any": "warn", 
  "@typescript-eslint/no-unused-vars": "warn",
  "no-console": ["warn", { "allow": ["warn", "error"] }]
}
```

### Pre-commit Hooks:
- ESLint --fix
- TypeScript type-check
- Confusables scan (warn-only)

## 🔧 Build Commands

### Development:
```bash
npm run dev                    # Development server
npm run build                  # Standard build
npm run build:ci              # CI build (deterministic)
npm run build:clean           # Clean + reinstall + build
```

### Quality Checks:
```bash
npm run stability:check       # Run stability analysis
npm run stability:fix         # Full stability repair
npm run check:unicode-confusables  # Unicode safety check
```

## 🚨 Emergency Procedures

### Build Failure:
1. `npm run stability:fix`
2. Check `scripts/stability-check.js` output
3. If still failing: `git checkout release/v4-ui-pass`

### Runtime Issues:
1. Check feature flags in `.env.local`
2. Set `NEXT_PUBLIC_KILL_SWITCH=true` if needed
3. Rollback to last known good commit

## 📊 Stability Metrics

Run `npm run stability:check` to get current stability score:
- Node version consistency
- SSR/SSG policy compliance  
- Client component boundaries
- Build dependencies
- Guardrails configuration

Target: **100% stability score** before any major release.

## 🔄 Release Process

1. **Pre-release:** `npm run checkpoint`
2. **Stability check:** `npm run stability:check` 
3. **Clean build:** `npm run build:ci`
4. **Tag:** `git tag v4-stable-$(date +%Y%m%d)`
5. **Deploy with canary:** Start with 5-10% traffic

## 📝 Contract Build (Team Guidelines)

### Dynamic Pages:
- `/profile` - User data, export functionality
- `/me` - Personal dashboard  
- `/chart` - Real-time charts
- `/chat` - AI interactions

### Static Pages:
- `/about` - Marketing content
- `/terms` - Legal content
- `/privacy` - Policy content

### Client-Only Logic:
- File downloads (`URL.createObjectURL`)
- Local storage access
- Browser APIs (`navigator`, `window`)
- Real-time features

### Environment Variables:
- **Required:** `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`
- **Optional:** Feature flags, AI keys
- **Development:** `AUTH_DEV_MODE=true`
