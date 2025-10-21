#!/bin/bash
# ANORA Phase 3 - Manual QA on Staging
# Real-world testing with actual users and data

set -e

# Configuration
BASE_URL="${BASE_URL:-https://staging.anora.app}"
TOKEN_U1="${TOKEN_U1:-}"
TOKEN_U2="${TOKEN_U2:-}"

# Test credentials (for documentation)
USER1_EMAIL="test1+qa@anora.top"
USER1_PASS="Qa!23456"
USER2_EMAIL="test2+qa@anora.top"
USER2_PASS="Qa!23456"

# Output configuration
RESULTS_DIR="./qa_results_$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="$RESULTS_DIR/evidence"
mkdir -p "$EVIDENCE_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ANORA MVP v0.9.0 - PHASE 3 MANUAL QA (STAGING)        ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Base URL:     $BASE_URL"
echo "Results:      $RESULTS_DIR"
echo "Test User 1:  $USER1_EMAIL"
echo "Test User 2:  $USER2_EMAIL"
echo ""
echo "Date:         $(date)"
echo ""

# Initialize results file
RESULTS_FILE="$RESULTS_DIR/test_results.csv"
echo "Category,Test Case,Status,Details,Timestamp" > "$RESULTS_FILE"

log_result() {
    local category="$1"
    local test="$2"
    local status="$3"
    local details="$4"
    local ts=$(date +"%Y-%m-%d %H:%M:%S")

    echo "$category,$test,$status,$details,$ts" >> "$RESULTS_FILE"

    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC} $test"
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗ FAIL${NC} $test - $details"
    else
        echo -e "${YELLOW}⚠ SKIP${NC} $test - $details"
    fi
}

# ============================================================================
# PHASE 0: Pre-flight Checks
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo " PHASE 0: Pre-flight Checks"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if staging is reachable
echo "Testing staging connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>&1 || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
    log_result "Infrastructure" "Staging Reachable" "PASS" "HTTP $HTTP_CODE"
else
    log_result "Infrastructure" "Staging Reachable" "FAIL" "HTTP $HTTP_CODE"
    echo ""
    echo -e "${RED}ERROR: Staging environment not reachable${NC}"
    echo "Please ensure staging is deployed and running at: $BASE_URL"
    exit 1
fi

# Check health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health" 2>&1 || echo "error")
if echo "$HEALTH_RESPONSE" | grep -q "ok\|healthy\|200"; then
    log_result "Infrastructure" "Health Endpoint" "PASS" "Responding"
else
    log_result "Infrastructure" "Health Endpoint" "FAIL" "Not responding"
fi

# Check if tokens are provided
if [ -z "$TOKEN_U1" ]; then
    echo ""
    echo -e "${YELLOW}⚠ WARNING: TOKEN_U1 not provided${NC}"
    echo ""
    echo "To run authenticated tests, please:"
    echo "1. Login to staging as $USER1_EMAIL"
    echo "2. Open DevTools → Application → Storage → Cookies"
    echo "3. Copy the 'sb-access-token' value"
    echo "4. Export: export TOKEN_U1='your_token_here'"
    echo ""
    echo "Then run: ./qa_staging_manual.sh"
    echo ""
    log_result "Setup" "User 1 Token" "SKIP" "Token not provided"
    TOKEN_U1=""
else
    log_result "Setup" "User 1 Token" "PASS" "Token provided"
fi

if [ -z "$TOKEN_U2" ]; then
    log_result "Setup" "User 2 Token" "SKIP" "Token not provided"
else
    log_result "Setup" "User 2 Token" "PASS" "Token provided"
fi

echo ""

# ============================================================================
# PHASE 1: Compliance Pages (Unauthenticated)
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo " PHASE 1: Compliance Pages"
echo "═══════════════════════════════════════════════════════════"
echo ""

test_compliance_page() {
    local page_name="$1"
    local page_path="$2"

    echo "Testing $page_name..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$page_path" 2>&1 || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        log_result "Compliance" "$page_name" "PASS" "HTTP 200"
    else
        log_result "Compliance" "$page_name" "FAIL" "HTTP $HTTP_CODE"
    fi
}

test_compliance_page "Privacy Policy" "/privacy"
test_compliance_page "Terms of Service" "/terms"
test_compliance_page "Medical Disclaimer" "/medical-disclaimer"
test_compliance_page "About Page" "/about"

echo ""

# ============================================================================
# PHASE 2: Log Endpoints (User 1)
# ============================================================================
if [ -n "$TOKEN_U1" ]; then
    echo "═══════════════════════════════════════════════════════════"
    echo " PHASE 2: Log Endpoints (User 1 - 5 iterations each)"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # BG Logs
    echo "Testing BG logging (5 iterations)..."
    for i in {1..5}; do
        VALUE=$((100 + RANDOM % 80))
        TAGS=("fasting" "before_meal" "after_meal" "bedtime" "random")
        TAG=${TAGS[$RANDOM % 5]}

        RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/bg" \
            -H "Authorization: Bearer $TOKEN_U1" \
            -H "Content-Type: application/json" \
            -d "{\"value_mgdl\":$VALUE,\"tag\":\"$TAG\",\"taken_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            2>&1)

        if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
            log_result "Log-BG" "BG Log #$i" "PASS" "value=$VALUE tag=$TAG"
            echo "  → $RESPONSE" | head -c 80
            echo "..."
        else
            log_result "Log-BG" "BG Log #$i" "FAIL" "Response: $RESPONSE"
        fi
        sleep 0.3
    done
    echo ""

    # Water Logs
    echo "Testing Water logging (5 iterations)..."
    for i in {1..5}; do
        ML=$((200 + RANDOM % 300))
        KINDS=("water" "tea" "coffee" "milk")
        KIND=${KINDS[$RANDOM % 4]}

        RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/water" \
            -H "Authorization: Bearer $TOKEN_U1" \
            -H "Content-Type: application/json" \
            -d "{\"amount_ml\":$ML,\"kind\":\"$KIND\",\"taken_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            2>&1)

        if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
            log_result "Log-Water" "Water Log #$i" "PASS" "ml=$ML kind=$KIND"
            echo "  → $RESPONSE" | head -c 80
            echo "..."
        else
            log_result "Log-Water" "Water Log #$i" "FAIL" "Response: $RESPONSE"
        fi
        sleep 0.3
    done
    echo ""

    # Weight Logs
    echo "Testing Weight logging (5 iterations)..."
    for i in {1..5}; do
        WEIGHT=$(awk -v min=65 -v max=75 'BEGIN{srand(); printf "%.1f", min+rand()*(max-min)}')

        RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/weight" \
            -H "Authorization: Bearer $TOKEN_U1" \
            -H "Content-Type: application/json" \
            -d "{\"weight_kg\":$WEIGHT,\"taken_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            2>&1)

        if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
            log_result "Log-Weight" "Weight Log #$i" "PASS" "weight=$WEIGHT kg"
            echo "  → $RESPONSE" | head -c 80
            echo "..."
        else
            log_result "Log-Weight" "Weight Log #$i" "FAIL" "Response: $RESPONSE"
        fi
        sleep 0.3
    done
    echo ""

    # BP Logs
    echo "Testing BP logging (5 iterations)..."
    for i in {1..5}; do
        SYS=$((110 + RANDOM % 30))
        DIA=$((70 + RANDOM % 20))
        PULSE=$((60 + RANDOM % 30))

        RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/bp" \
            -H "Authorization: Bearer $TOKEN_U1" \
            -H "Content-Type: application/json" \
            -d "{\"systolic\":$SYS,\"diastolic\":$DIA,\"pulse\":$PULSE,\"taken_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            2>&1)

        if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
            log_result "Log-BP" "BP Log #$i" "PASS" "$SYS/$DIA pulse=$PULSE"
            echo "  → $RESPONSE" | head -c 80
            echo "..."
        else
            log_result "Log-BP" "BP Log #$i" "FAIL" "Response: $RESPONSE"
        fi
        sleep 0.3
    done
    echo ""

    # Insulin Logs
    echo "Testing Insulin logging (5 iterations)..."
    for i in {1..5}; do
        DOSE=$(awk 'BEGIN{srand(); printf "%.1f", 2+rand()*8}')
        TYPES=("bolus" "basal" "mixed" "correction")
        TYPE=${TYPES[$RANDOM % 4]}

        RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/insulin" \
            -H "Authorization: Bearer $TOKEN_U1" \
            -H "Content-Type: application/json" \
            -d "{\"dose_units\":$DOSE,\"type\":\"$TYPE\",\"taken_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            2>&1)

        if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
            log_result "Log-Insulin" "Insulin Log #$i" "PASS" "dose=$DOSE type=$TYPE"
            echo "  → $RESPONSE" | head -c 80
            echo "..."
        else
            log_result "Log-Insulin" "Insulin Log #$i" "FAIL" "Response: $RESPONSE"
        fi
        sleep 0.3
    done
    echo ""

    # Meal Logs
    echo "Testing Meal logging (5 iterations)..."
    MEALS=("Yến mạch + trứng" "Cơm gạo lứt + cá hồi" "Salad rau củ + ức gà" "Bánh mì nguyên cám + bơ" "Cháo gà + rau xanh")
    MEAL_TYPES=("breakfast" "lunch" "dinner" "snack")

    for i in {1..5}; do
        MEAL=${MEALS[$((i-1))]}
        TYPE=${MEAL_TYPES[$RANDOM % 4]}

        RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/meal" \
            -H "Authorization: Bearer $TOKEN_U1" \
            -H "Content-Type: application/json" \
            -d "{\"meal_type\":\"$TYPE\",\"text\":\"$MEAL\",\"portion\":\"medium\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
            2>&1)

        if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
            log_result "Log-Meal" "Meal Log #$i" "PASS" "type=$TYPE text=$MEAL"
            echo "  → $RESPONSE" | head -c 80
            echo "..."
        else
            log_result "Log-Meal" "Meal Log #$i" "FAIL" "Response: $RESPONSE"
        fi
        sleep 0.3
    done
    echo ""
fi

# ============================================================================
# PHASE 3: Export CSV (User 1)
# ============================================================================
if [ -n "$TOKEN_U1" ]; then
    echo "═══════════════════════════════════════════════════════════"
    echo " PHASE 3: Export CSV (User 1)"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    echo "Exporting 7-day CSV..."
    curl -s -H "Authorization: Bearer $TOKEN_U1" \
        "$BASE_URL/api/export" \
        -o "$EVIDENCE_DIR/export_u1_7d.csv"

    if [ -f "$EVIDENCE_DIR/export_u1_7d.csv" ]; then
        SIZE=$(wc -c < "$EVIDENCE_DIR/export_u1_7d.csv")
        LINES=$(wc -l < "$EVIDENCE_DIR/export_u1_7d.csv")

        if [ $SIZE -gt 100 ] && [ $LINES -gt 1 ]; then
            log_result "Export" "CSV Export (U1)" "PASS" "$SIZE bytes, $LINES lines"
            echo "  File: $EVIDENCE_DIR/export_u1_7d.csv"
            echo "  Preview:"
            head -5 "$EVIDENCE_DIR/export_u1_7d.csv" | sed 's/^/    /'
        else
            log_result "Export" "CSV Export (U1)" "FAIL" "File too small ($SIZE bytes)"
        fi
    else
        log_result "Export" "CSV Export (U1)" "FAIL" "File not created"
    fi
    echo ""
fi

# ============================================================================
# PHASE 4: RLS Verification (User 2)
# ============================================================================
if [ -n "$TOKEN_U1" ] && [ -n "$TOKEN_U2" ]; then
    echo "═══════════════════════════════════════════════════════════"
    echo " PHASE 4: RLS Isolation (User 2)"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # User 2 creates different data
    echo "Creating test data for User 2..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/log/bg" \
        -H "Authorization: Bearer $TOKEN_U2" \
        -H "Content-Type: application/json" \
        -d "{\"value_mgdl\":88,\"tag\":\"fasting\",\"taken_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
        2>&1)

    if echo "$RESPONSE" | grep -q '"ok":true\|"id"'; then
        log_result "RLS" "User 2 Log Creation" "PASS" "BG=88"
    else
        log_result "RLS" "User 2 Log Creation" "FAIL" "Could not create log"
    fi

    # Export for User 2
    echo "Exporting CSV for User 2..."
    curl -s -H "Authorization: Bearer $TOKEN_U2" \
        "$BASE_URL/api/export" \
        -o "$EVIDENCE_DIR/export_u2_7d.csv"

    if [ -f "$EVIDENCE_DIR/export_u2_7d.csv" ]; then
        SIZE_U1=$(wc -c < "$EVIDENCE_DIR/export_u1_7d.csv" 2>/dev/null || echo "0")
        SIZE_U2=$(wc -c < "$EVIDENCE_DIR/export_u2_7d.csv")

        # Compare exports (should be different)
        DIFF_LINES=$(diff "$EVIDENCE_DIR/export_u1_7d.csv" "$EVIDENCE_DIR/export_u2_7d.csv" 2>/dev/null | wc -l || echo "999")

        if [ $DIFF_LINES -gt 0 ]; then
            log_result "RLS" "Data Isolation" "PASS" "U1 ≠ U2 exports ($DIFF_LINES diff lines)"
            echo "  U1 export: $SIZE_U1 bytes"
            echo "  U2 export: $SIZE_U2 bytes"
        else
            log_result "RLS" "Data Isolation" "FAIL" "Exports are identical (RLS breach)"
        fi
    fi
    echo ""
fi

# ============================================================================
# PHASE 5: Manual Test Instructions
# ============================================================================
echo "═══════════════════════════════════════════════════════════"
echo " PHASE 5: Manual Test Instructions"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "The following tests require manual intervention:"
echo ""
echo "1. DELETE ACCOUNT (Wrong Password):"
echo "   - Login as $USER1_EMAIL"
echo "   - Navigate to /profile"
echo "   - Click 'Xóa tài khoản'"
echo "   - Enter WRONG password"
echo "   - Expected: Error message, account NOT deleted"
echo ""
echo "2. DELETE ACCOUNT (Correct Password):"
echo "   - After above test, enter CORRECT password: $USER1_PASS"
echo "   - Expected: Account deleted, logged out, cannot login again"
echo ""
echo "3. CHART VISUALIZATION:"
echo "   - Login as $USER2_EMAIL (still has data)"
echo "   - Navigate to /chart"
echo "   - Toggle between 7 days and 30 days"
echo "   - Expected: Real data displayed (not demo/fallback)"
echo ""
echo "4. DASHBOARD USERNAME:"
echo "   - Check Dashboard header shows user's actual name/email"
echo "   - Expected: NOT showing 'Tuấn Anh' hardcoded"
echo ""

log_result "Manual" "Delete Wrong Password" "PENDING" "Requires UI test"
log_result "Manual" "Delete Correct Password" "PENDING" "Requires UI test"
log_result "Manual" "Chart Visualization" "PENDING" "Requires UI test"
log_result "Manual" "Dashboard Username" "PENDING" "Requires UI test"

echo ""

# ============================================================================
# SUMMARY & REPORT
# ============================================================================
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                   TEST SUMMARY                            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

TOTAL=$(grep -c "," "$RESULTS_FILE" || echo "1")
TOTAL=$((TOTAL - 1)) # Subtract header
PASS_COUNT=$(grep ",PASS," "$RESULTS_FILE" | wc -l || echo "0")
FAIL_COUNT=$(grep ",FAIL," "$RESULTS_FILE" | wc -l || echo "0")
SKIP_COUNT=$(grep ",SKIP," "$RESULTS_FILE" | wc -l || echo "0")
PENDING_COUNT=$(grep ",PENDING," "$RESULTS_FILE" | wc -l || echo "0")

echo "  Total Tests:       $TOTAL"
echo -e "  ${GREEN}✓ Passed:${NC}          $PASS_COUNT"
echo -e "  ${RED}✗ Failed:${NC}          $FAIL_COUNT"
echo -e "  ${YELLOW}⚠ Skipped:${NC}         $SKIP_COUNT"
echo -e "  ${BLUE}⏳ Pending Manual:${NC} $PENDING_COUNT"
echo ""

# Category breakdown
echo "Breakdown by Category:"
echo ""
for cat in Infrastructure Setup Compliance Log-BG Log-Water Log-Weight Log-BP Log-Insulin Log-Meal Export RLS Manual; do
    COUNT=$(grep "^$cat," "$RESULTS_FILE" | wc -l || echo "0")
    if [ $COUNT -gt 0 ]; then
        PASS=$(grep "^$cat,.*,PASS," "$RESULTS_FILE" | wc -l || echo "0")
        echo "  $cat: $PASS/$COUNT passed"
    fi
done
echo ""

# Output locations
echo "Results saved to:"
echo "  - Test results:   $RESULTS_FILE"
echo "  - CSV exports:    $EVIDENCE_DIR/"
echo ""

# GO/NO-GO determination
if [ $FAIL_COUNT -eq 0 ]; then
    if [ $PASS_COUNT -ge 30 ]; then
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║                                                           ║"
        echo "║     ✅ GO FOR STORE SUBMISSION (after manual tests)       ║"
        echo "║                                                           ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        exit 0
    else
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║  ⚠️  CONDITIONAL GO - Complete manual tests first         ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        exit 0
    fi
else
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  ❌ NO-GO - Fix failures before Store submission          ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    exit 1
fi
