# 🧪 **DIABOT AUTH TESTING - COMPREHENSIVE PROTOCOL**

## 📊 **STEP 1: ENV & SERVER CHECK - RESULTS**

### **✅ ENVIRONMENT STATUS:**
- **Node.js:** v20.14.2
- **Next.js:** ^14.2.32  
- **transpilePackages:** ✅ Found in next.config files
- **Dev Server:** ✅ Running on port 3000

### **🔧 ENVIRONMENT VARIABLES:**
```
AUTH_DEV_MODE
PGHOST / PGUSER / PGPASSWORD / PGDATABASE
SESSION_COOKIE_NAME=asinu.sid
```

## 🚫 **STEP 2: SMOKE UNAUTH - RESULTS**

### **API ENDPOINTS (No Auth Headers):**
- **POST /api/log/water:** HTTP/1.1 401 ✅
- **POST /api/log/meal:** HTTP/1.1 401 ✅  
- **POST /api/log/bg:** HTTP/1.1 401 ✅
- **POST /api/log/insulin:** HTTP/1.1 401 ✅
- **POST /api/log/weight:** HTTP/1.1 401 ✅
- **POST /api/log/bp:** HTTP/1.1 401 ✅
- **GET /api/profile:** HTTP/1.1 401 ✅
- **GET /api/chart:** HTTP/1.1 401 ✅

**✅ UNAUTH PROTECTION: PASS** - All endpoints correctly return 401 Unauthorized

---

## 🔐 **STEP 3: AUTH SESSION SETUP**

### **MANUAL STEPS REQUIRED:**

1. **Navigate to:** http://localhost:3000/auth/login
2. **Login with credentials** (email/password or OAuth)
3. **Extract cookies from DevTools:**
   - Open DevTools → Application → Cookies
   - Copy value for: `asinu.sid`

---

## 🧪 **STEP 4: SMOKE AUTH TESTING**

### **TEMPLATE COMMANDS (Replace COOKIES):**

```bash
# Set your cookies here
COOKIES="asinu.sid=YOUR_SESSION_JWT"

# Test all 6 POST endpoints
curl -i -X POST -H "Cookie: $COOKIES" -H "Content-Type: application/json" \
  -d '{"amount_ml":250,"taken_at":"2025-01-27T10:00:00.000Z"}' \
  http://localhost:3000/api/log/water

curl -i -X POST -H "Cookie: $COOKIES" -H "Content-Type: application/json" \
  -d '{"items":["Rice","Chicken"],"taken_at":"2025-01-27T12:00:00.000Z"}' \
  http://localhost:3000/api/log/meal

curl -i -X POST -H "Cookie: $COOKIES" -H "Content-Type: application/json" \
  -d '{"value_mgdl":110,"tag":"fasting","taken_at":"2025-01-27T07:00:00.000Z"}' \
  http://localhost:3000/api/log/bg

curl -i -X POST -H "Cookie: $COOKIES" -H "Content-Type: application/json" \
  -d '{"dose_units":5,"type":"bolus","taken_at":"2025-01-27T12:30:00.000Z"}' \
  http://localhost:3000/api/log/insulin

curl -i -X POST -H "Cookie: $COOKIES" -H "Content-Type: application/json" \
  -d '{"weight_kg":70.5,"taken_at":"2025-01-27T08:00:00.000Z"}' \
  http://localhost:3000/api/log/weight

curl -i -X POST -H "Cookie: $COOKIES" -H "Content-Type: application/json" \
  -d '{"systolic":120,"diastolic":80,"pulse":72,"taken_at":"2025-01-27T09:00:00.000Z"}' \
  http://localhost:3000/api/log/bp

# Test 2 GET endpoints  
curl -i -H "Cookie: $COOKIES" http://localhost:3000/api/profile/YOUR_USER_ID
curl -i -H "Cookie: $COOKIES" "http://localhost:3000/api/chart/bg_avg?range=7d"
```

**Expected Results:** 200/201 status codes with successful data insertion

---

## 🗄️ **STEP 5: DATABASE VERIFICATION**

### **SQL QUERIES (psql / direct Postgres connection):**

```sql
-- Replace YOUR_USER_ID with actual authenticated user ID
select count(*) from asinu_app.water_logs   where user_id='YOUR_USER_ID';
select count(*) from asinu_app.meal_logs    where user_id='YOUR_USER_ID';  
select count(*) from asinu_app.glucose_logs where user_id='YOUR_USER_ID';
select count(*) from asinu_app.insulin_logs where user_id='YOUR_USER_ID';
select count(*) from asinu_app.weight_logs  where user_id='YOUR_USER_ID';
select count(*) from asinu_app.bp_logs      where user_id='YOUR_USER_ID';
select * from asinu_app.profiles where id='YOUR_USER_ID';
```

**Expected Results:** Counts > 0 for successful API calls, profile data present

---

## 📋 **STEP 6: FINAL REPORT STRUCTURE**

### **AUTH_REPORT.md Template:**

```markdown
# DIABOT AUTH TESTING - FINAL REPORT

## EXECUTIVE SUMMARY
- **Status:** [PASS/FAIL/PARTIAL]
- **Environment:** [Production/Staging/Dev]
- **Date:** [Test Date]

## TEST RESULTS

### Step 1: Environment ✅/❌
- Node.js: [Version]
- Dependencies: [Status]
- Server: [Status]

### Step 2: Unauth Protection ✅/❌  
- All endpoints return 401: [PASS/FAIL]

### Step 3: Authentication ✅/❌
- Login successful: [PASS/FAIL]
- Session cookies obtained: [PASS/FAIL]

### Step 4: Authenticated API Calls ✅/❌
- POST endpoints (6): [X/6 PASS]
- GET endpoints (2): [X/2 PASS]

### Step 5: Database Verification ✅/❌
- Data insertion confirmed: [PASS/FAIL]
- Profile access working: [PASS/FAIL]

## RISKS & RECOMMENDATIONS
[List any issues found and recommendations]

## FINAL VERDICT
[PASS/FAIL with reasoning]
```

---

## 🎯 **CURRENT STATUS**

**✅ COMPLETED:**
- Step 1: Environment verified
- Step 2: Unauth protection confirmed

**⏸️ PENDING:**
- Step 3: Manual login required
- Step 4: Authenticated API testing
- Step 5: Database verification  
- Step 6: Final report generation

**👉 NEXT ACTION:** Please complete the manual login step and provide session cookies to continue testing.
