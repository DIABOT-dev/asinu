#!/bin/bash
# verify-deployment.sh
# Post-deployment verification script for Anora
# Usage: ./scripts/verify-deployment.sh <BASE_URL>
# Example: ./scripts/verify-deployment.sh https://anora.example.com

set -e

BASE_URL="${1:-http://localhost}"
REPORT_FILE="deployment-verification-$(date +%Y%m%d-%H%M%S).log"

echo "=========================================="
echo "Anora Post-Deployment Verification"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Report: $REPORT_FILE"
echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "=========================================="
echo ""

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local description="$4"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing $name... "

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")

    if [ "$HTTP_CODE" = "$expected_status" ]; then
        echo "✅ PASS (HTTP $HTTP_CODE)"
        echo "✅ PASS: $name - HTTP $HTTP_CODE - $description" >> "$REPORT_FILE"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo "❌ FAIL (Expected $expected_status, Got $HTTP_CODE)"
        echo "❌ FAIL: $name - Expected $expected_status, Got $HTTP_CODE - $description" >> "$REPORT_FILE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Helper function to test JSON endpoint
test_json_endpoint() {
    local name="$1"
    local url="$2"
    local jq_filter="$3"
    local expected_value="$4"
    local description="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing $name... "

    RESPONSE=$(curl -s "$url")
    ACTUAL_VALUE=$(echo "$RESPONSE" | jq -r "$jq_filter" 2>/dev/null || echo "ERROR")

    if [ "$ACTUAL_VALUE" = "$expected_value" ]; then
        echo "✅ PASS ($jq_filter = $expected_value)"
        echo "✅ PASS: $name - $jq_filter = $expected_value - $description" >> "$REPORT_FILE"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo "❌ FAIL (Expected $expected_value, Got $ACTUAL_VALUE)"
        echo "❌ FAIL: $name - Expected $expected_value, Got $ACTUAL_VALUE - $description" >> "$REPORT_FILE"
        echo "Response: $RESPONSE" >> "$REPORT_FILE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Start verification
{
    echo "=========================================="
    echo "Anora Post-Deployment Verification Report"
    echo "=========================================="
    echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Base URL: $BASE_URL"
    echo "Release: 2025-10-07-stable"
    echo "Version: 0.9.0"
    echo "=========================================="
    echo ""
} > "$REPORT_FILE"

echo "📋 Running verification tests..."
echo ""

# Test 1: Health Check
echo "## 1. HEALTH CHECK ENDPOINTS" | tee -a "$REPORT_FILE"
test_endpoint "Health Check" "$BASE_URL/api/health" "200" "Basic health endpoint"
test_endpoint "Health Check (alternate)" "$BASE_URL/api/healthz" "200" "Kubernetes health check endpoint"
echo "" | tee -a "$REPORT_FILE"

# Test 2: QA Selftest
echo "## 2. QA SELFTEST ENDPOINT" | tee -a "$REPORT_FILE"
test_endpoint "QA Selftest" "$BASE_URL/api/qa/selftest" "200" "Automated QA validation"

# Test 2b: QA Selftest Details
echo -n "Checking QA Selftest details... "
SELFTEST=$(curl -s "$BASE_URL/api/qa/selftest")
VERSION=$(echo "$SELFTEST" | jq -r '.meta.version')
PASSED=$(echo "$SELFTEST" | jq -r '.stats.passed')
TOTAL=$(echo "$SELFTEST" | jq -r '.stats.total')
KILL_SWITCH=$(echo "$SELFTEST" | jq -r '.featureFlags.killSwitch // false')

echo "Version: $VERSION, Tests: $PASSED/$TOTAL, Kill Switch: $KILL_SWITCH"
{
    echo "  Version: $VERSION"
    echo "  Tests Passed: $PASSED/$TOTAL"
    echo "  Kill Switch: $KILL_SWITCH"
    echo "  Full Response:"
    echo "$SELFTEST" | jq '.'
} >> "$REPORT_FILE"

if [ "$VERSION" = "0.9.0" ] && [ "$KILL_SWITCH" = "false" ]; then
    echo "✅ QA Selftest validation PASS" | tee -a "$REPORT_FILE"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ QA Selftest validation FAIL" | tee -a "$REPORT_FILE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo "" | tee -a "$REPORT_FILE"

# Test 3: Authentication Pages
echo "## 3. AUTHENTICATION PAGES" | tee -a "$REPORT_FILE"
test_endpoint "Login Page" "$BASE_URL/auth/login" "200" "User login page"
test_endpoint "Register Page" "$BASE_URL/auth/register" "200" "User registration page"
echo "" | tee -a "$REPORT_FILE"

# Test 4: Protected API Endpoints (should return 401)
echo "## 4. PROTECTED API ENDPOINTS (Authentication Required)" | tee -a "$REPORT_FILE"
test_endpoint "BG Logging API" "$BASE_URL/api/log/bg" "401" "Blood glucose logging endpoint (protected)"
test_endpoint "Water Logging API" "$BASE_URL/api/log/water" "401" "Water logging endpoint (protected)"
test_endpoint "Meal Logging API" "$BASE_URL/api/log/meal" "401" "Meal logging endpoint (protected)"
test_endpoint "Insulin Logging API" "$BASE_URL/api/log/insulin" "401" "Insulin logging endpoint (protected)"
test_endpoint "BP Logging API" "$BASE_URL/api/log/bp" "401" "Blood pressure logging endpoint (protected)"
test_endpoint "Weight Logging API" "$BASE_URL/api/log/weight" "401" "Weight logging endpoint (protected)"
test_endpoint "Chart API" "$BASE_URL/api/charts/bg?range=7d" "401" "Chart data endpoint (protected)"
test_endpoint "Export API" "$BASE_URL/api/export" "401" "CSV export endpoint (protected)"
echo "" | tee -a "$REPORT_FILE"

# Test 5: Public Pages
echo "## 5. PUBLIC PAGES" | tee -a "$REPORT_FILE"
test_endpoint "Home Page" "$BASE_URL/" "200" "Landing page"
test_endpoint "About Page" "$BASE_URL/about" "200" "About page"
test_endpoint "Privacy Policy" "$BASE_URL/privacy" "200" "Privacy policy page"
test_endpoint "Terms of Service" "$BASE_URL/terms" "200" "Terms of service page"
echo "" | tee -a "$REPORT_FILE"

# Test 6: Static Assets (sample check)
echo "## 6. STATIC ASSETS" | tee -a "$REPORT_FILE"
echo -n "Checking static asset caching... "

# Find a webpack chunk URL (this is a placeholder - real URL will vary)
# In production, you'd parse the actual page to find chunk URLs
CHUNK_SAMPLE="/_next/static/chunks/webpack-[hash].js"
echo "Sample: $CHUNK_SAMPLE"
echo "Note: Actual chunk URLs vary per build" >> "$REPORT_FILE"
echo "Check browser DevTools Network tab for cache headers" >> "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Test 7: AI Gateway
echo "## 7. AI GATEWAY" | tee -a "$REPORT_FILE"
test_endpoint "AI Gateway Health" "$BASE_URL/api/ai/gateway" "200" "AI Gateway health check"
echo "" | tee -a "$REPORT_FILE"

# Test 8: Feature Flags
echo "## 8. FEATURE FLAGS" | tee -a "$REPORT_FILE"
echo -n "Checking feature flags configuration... "
FLAGS=$(curl -s "$BASE_URL/api/qa/selftest" | jq '.featureFlags')
{
    echo "Feature Flags:"
    echo "$FLAGS" | jq '.'
} >> "$REPORT_FILE"

KILL_SWITCH_FLAG=$(echo "$FLAGS" | jq -r '.killSwitch // false')
if [ "$KILL_SWITCH_FLAG" = "false" ]; then
    echo "✅ Kill switch is OFF (correct)" | tee -a "$REPORT_FILE"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "❌ Kill switch is ON (incorrect)" | tee -a "$REPORT_FILE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo "" | tee -a "$REPORT_FILE"

# Test 9: Response Times
echo "## 9. PERFORMANCE (Response Times)" | tee -a "$REPORT_FILE"
echo -n "Measuring response times... "

HEALTH_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/health")
SELFTEST_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/qa/selftest")
LOGIN_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/auth/login")

{
    echo "Response Times:"
    echo "  /api/health: ${HEALTH_TIME}s"
    echo "  /api/qa/selftest: ${SELFTEST_TIME}s"
    echo "  /auth/login: ${LOGIN_TIME}s"
} | tee -a "$REPORT_FILE"

# Basic performance check (health should be under 1s)
if (( $(echo "$HEALTH_TIME < 1.0" | bc -l) )); then
    echo "✅ Performance check PASS (health < 1s)" | tee -a "$REPORT_FILE"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo "⚠️  Performance check WARN (health >= 1s)" | tee -a "$REPORT_FILE"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo "" | tee -a "$REPORT_FILE"

# Summary
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
{
    echo ""
    echo "=========================================="
    echo "VERIFICATION SUMMARY"
    echo "=========================================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""
} | tee -a "$REPORT_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ ALL TESTS PASSED" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    echo "🎉 Deployment verification successful!"
    echo "Report saved to: $REPORT_FILE"
    exit 0
else
    echo "❌ SOME TESTS FAILED" | tee -a "$REPORT_FILE"
    echo "" | tee -a "$REPORT_FILE"
    echo "⚠️  Deployment verification completed with failures"
    echo "Report saved to: $REPORT_FILE"
    echo ""
    echo "Review failed tests and investigate:"
    grep "❌ FAIL" "$REPORT_FILE"
    exit 1
fi
