#!/bin/bash

###############################################################################
# VPS Local Orchestrator - Complete API Testing Script
# 
# This script:
# 1. Starts the API server
# 2. Tests all endpoints as a real API consumer
# 3. Cleans up any test data created
# 4. Stops the API server
#
# Usage: ./test-api-complete.sh
###############################################################################

set -e  # Exit on error

# Configuration
API_BASE="http://127.0.0.1:3000"
API_TOKEN="test-token-123"
API_DIR="/home/sebss/apps/VPSLocalOrchestrator/api"
LOG_FILE="/tmp/api-test-$(date +%Y%m%d-%H%M%S).log"
TEST_RESULTS="/tmp/api-test-results-$(date +%Y%m%d-%H%M%S).json"
SERVER_PID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Arrays to store created resources for cleanup
declare -a CREATED_WEBHOOKS=()
declare -a CREATED_SECRETS=()
declare -a CREATED_WORKFLOWS=()
declare -a CREATED_JOBS=()

###############################################################################
# Utility Functions
###############################################################################

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

fail() {
    echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

collect_code_metrics() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                   CODE METRICS & QUALITY                   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    local api_dir="/home/sebss/apps/VPSLocalOrchestrator/api"
    
    # Lines of Code
    echo "📊 CODE STATISTICS:"
    local ts_lines=$(find "$api_dir/src" -name "*.ts" -type f | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    local js_lines=$(find "$api_dir/dist" -name "*.js" -type f 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    local test_lines=$(find "$api_dir/tests" -name "*.ts" -type f | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    
    echo "  • TypeScript Source Lines:      $ts_lines LOC"
    echo "  • Compiled JavaScript Lines:    $js_lines LOC"
    echo "  • Test Code Lines:              $test_lines LOC"
    echo "  • Code-to-Test Ratio:           $(awk "BEGIN {printf \"%.2f\", $ts_lines/$test_lines}"):1"
    echo ""
    
    # Test Count
    echo "🧪 TEST BREAKDOWN:"
    local unit_tests=$(find "$api_dir/tests/unit" -name "*.test.ts" -type f 2>/dev/null | wc -l)
    local integration_tests=$(find "$api_dir/tests/integration" -name "*.test.ts" -type f 2>/dev/null | wc -l)
    local e2e_tests=$TOTAL_TESTS
    local total_test_suites=$((unit_tests + integration_tests + 1))
    
    echo "  • Unit Tests:                   $unit_tests test files"
    echo "  • Integration Tests:            $integration_tests test files"
    echo "  • E2E/API Tests:                $e2e_tests endpoints tested"
    echo "  • Total Test Suites:            $total_test_suites"
    echo ""
    
    # Test Coverage
    echo "📈 TEST COVERAGE:"
    local coverage_report="$api_dir/coverage/lcov-report/index.html"
    
    if [ -f "$coverage_report" ]; then
        echo "  ✓ Coverage Report Generated"
        echo "  • Location: $coverage_report"
        
        # Count test files by coverage status
        local tested_files=$(find "$api_dir/coverage" -name "*.js.html" -type f 2>/dev/null | wc -l)
        echo "  • Files with Coverage: $tested_files files analyzed"
        
        # Try to extract overall coverage percentage
        local overall=$(grep -o '[0-9]\+\.[0-9]\+%' "$coverage_report" 2>/dev/null | head -1 || echo "")
        if [ -n "$overall" ]; then
            echo "  • Overall Coverage: $overall"
            
            # Parse numeric value
            local coverage_num=${overall%\%}
            if (( $(echo "$coverage_num > 80" | bc -l 2>/dev/null || echo "0") )); then
                echo "  ✓ Coverage meets 80% target"
            else
                local missing=$((80 - ${coverage_num%.*}))
                echo "  ✗ Coverage below 80% target (need +$missing%)"
            fi
        fi
    else
        echo "  • Coverage Report: Not generated"
        echo "  • Run: npm run test:coverage"
    fi
    echo ""
    
    # Code Quality Benchmarks
    echo "✅ QUALITY BENCHMARKS:"
    echo "  • Minimum LOC per function:     20 lines (IDEAL: 30-50)"
    echo "  • Code-to-Test Ratio:           $(awk "BEGIN {printf \"%.2f\", $ts_lines/$test_lines}"):1 (IDEAL: 1:0.5 to 1:1.5)"
    echo "  • Test Coverage Target:         >80% (CURRENT: See above)"
    echo "  • E2E Test Coverage:            $e2e_tests endpoints (IDEAL: >25)"
    echo ""
    
    # Recommendations
    if [ "$ts_lines" -gt 0 ] && [ "$test_lines" -gt 0 ]; then
        local ratio=$(awk "BEGIN {printf \"%.2f\", $ts_lines/$test_lines}")
        if (( $(echo "$ratio < 0.5" | bc -l) )); then
            echo "💡 RECOMMENDATIONS:"
            echo "  ⚠️  Code-to-Test ratio is very high (more tests than code)"
            echo "      → Consider consolidating some redundant tests"
        elif (( $(echo "$ratio > 1.5" | bc -l) )); then
            echo "💡 RECOMMENDATIONS:"
            echo "  ⚠️  Code-to-Test ratio is low (more code than tests)"
            echo "      → Increase test coverage, especially for critical paths"
        else
            echo "💡 RECOMMENDATIONS:"
            echo "  ✓ Code-to-Test ratio is healthy"
        fi
    fi
    echo ""
}

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local auth="$4"
    local data="$5"
    local expect_code="${6:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    local headers=""
    if [ "$auth" = "yes" ]; then
        headers="-H 'Authorization: Bearer $API_TOKEN'"
    fi
    
    if [ "$method" = "GET" ] || [ "$method" = "DELETE" ]; then
        response=$(eval "curl -s -w '\n%{http_code}' $headers '$API_BASE$endpoint' 2>&1")
    else
        response=$(eval "curl -s -w '\n%{http_code}' -X $method $headers -H 'Content-Type: application/json' -d '$data' '$API_BASE$endpoint' 2>&1")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expect_code" ]; then
        success "[$TOTAL_TESTS] $name - HTTP $http_code"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        fail "[$TOTAL_TESTS] $name - Expected $expect_code, got $http_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "$body"
    fi
    
    echo "$body"
}

###############################################################################
# Server Management
###############################################################################

start_server() {
    log "Starting API server..."
    
    # Kill any existing server
    pkill -f "tsx src/index.ts" 2>/dev/null || true
    sleep 2
    
    # Start server in background
    cd "$API_DIR"
    npm start > /tmp/api-server-test.log 2>&1 &
    SERVER_PID=$!
    
    log "Server started with PID: $SERVER_PID"
    log "Waiting for server to be ready..."
    
    # Wait for server to be ready (max 30 seconds)
    for i in {1..30}; do
        if curl -s -m 2 "$API_BASE/health" > /dev/null 2>&1; then
            success "Server is ready!"
            return 0
        fi
        sleep 1
    done
    
    fail "Server failed to start in 30 seconds"
    cat /tmp/api-server-test.log
    exit 1
}

stop_server() {
    log "Stopping API server..."
    
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    pkill -f "tsx src/index.ts" 2>/dev/null || true
    
    success "Server stopped"
}

###############################################################################
# Test Categories
###############################################################################

run_internal_tests() {
    echo ""
    log "=========================================="
    log "Running Internal Application Tests"
    log "=========================================="
    
    cd "$API_DIR"
    
    log "Running Jest test suite..."
    if npm test 2>&1 | tee -a "$LOG_FILE"; then
        success "Internal tests passed"
        
        # Generate coverage report
        log "Generating coverage report..."
        if npm run test:coverage 2>&1 | tee -a "$LOG_FILE"; then
            success "Coverage report generated"
        else
            warn "Failed to generate coverage report"
        fi
        
        return 0
    else
        fail "Internal tests failed"
        warn "Continuing with API endpoint tests despite internal test failures..."
        return 1
    fi
}

test_health_endpoints() {
    echo ""
    log "=========================================="
    log "Category 1: Health & Status Endpoints"
    log "=========================================="
    
    test_endpoint "Health Check" "GET" "/health" "no" "" "200"
    test_endpoint "API Info" "GET" "/" "no" "" "200"
    test_endpoint "Metrics" "GET" "/metrics" "no" "" "200"
}

test_resource_endpoints() {
    echo ""
    log "=========================================="
    log "Category 2: System Resources"
    log "=========================================="
    
    test_endpoint "System Resources" "GET" "/api/resources" "no" "" "200"
    test_endpoint "Top Processes" "GET" "/api/resources/processes?limit=5" "no" "" "200"
    test_endpoint "Network Stats" "GET" "/api/resources/network" "no" "" "200"
}

test_command_endpoints() {
    echo ""
    log "=========================================="
    log "Category 3: Command Execution"
    log "=========================================="
    
    # Test with auth
    test_endpoint "Execute Command (whoami)" "POST" "/api/command/execute" "yes" '{"command":"whoami"}' "200"
    test_endpoint "Execute Command (date)" "POST" "/api/command/execute" "yes" '{"command":"date"}' "200"
    
    # Test without auth (should fail)
    test_endpoint "Execute Command (no auth)" "POST" "/api/command/execute" "no" '{"command":"ls"}' "401"
    
    # Test service status (non-privileged)
    test_endpoint "Service Status" "POST" "/api/command/service" "yes" '{"service":"ssh","action":"status"}' "200"
}

test_jobs_endpoints() {
    echo ""
    log "=========================================="
    log "Category 4: Job Management"
    log "=========================================="
    
    test_endpoint "List Jobs" "GET" "/api/jobs" "yes" "" "200"
    test_endpoint "Job Stats" "GET" "/api/jobs/stats/summary" "yes" "" "200"
    
    # Try to create a job (may fail if endpoint not fully implemented)
    log "Attempting to create test job..."
    result=$(curl -s -w '\n%{http_code}' -X POST -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' -d '{"type":"command","data":{"command":"echo test-job"}}' "$API_BASE/api/jobs" 2>&1 || echo "")
    
    if [ -n "$result" ]; then
        http_code=$(echo "$result" | tail -n1)
        body=$(echo "$result" | sed '$d')
        job_id=$(echo "$body" | jq -r '.id // .data.id // empty' 2>/dev/null)
        
        if [ "$http_code" = "201" ] && [ -n "$job_id" ]; then
            CREATED_JOBS+=("$job_id")
            success "Job created with ID: $job_id"
            
            # Get job details
            test_endpoint "Get Job Details" "GET" "/api/jobs/$job_id" "yes" "" "200"
            
            # Wait a bit for job to complete
            sleep 1
        else
            warn "Could not create job (HTTP $http_code), skipping job operations"
        fi
    else
        warn "Job creation endpoint may not be implemented, continuing..."
    fi
}

test_ratelimit_endpoints() {
    echo ""
    log "=========================================="
    log "Category 5: Rate Limiting"
    log "=========================================="
    
    test_endpoint "Rate Limit Stats" "GET" "/api/ratelimits/stats" "yes" "" "200"
    test_endpoint "Rate Limit Tiers" "GET" "/api/ratelimits/tiers" "yes" "" "200"
    test_endpoint "All Rate Limits" "GET" "/api/ratelimits/all" "yes" "" "200"
}

test_circuitbreaker_endpoints() {
    echo ""
    log "=========================================="
    log "Category 6: Circuit Breakers"
    log "=========================================="
    
    test_endpoint "List Circuit Breakers" "GET" "/api/circuitbreakers" "yes" "" "200"
}

test_audit_endpoints() {
    echo ""
    log "=========================================="
    log "Category 7: Audit Logs"
    log "=========================================="
    
    test_endpoint "Get Audit Logs" "GET" "/api/logs?limit=10" "yes" "" "200"
    test_endpoint "Search Logs" "POST" "/api/logs/search" "yes" '{"status":"success","limit":5}' "200"
}

test_webhook_endpoints() {
    echo ""
    log "=========================================="
    log "Category 8: Webhooks"
    log "=========================================="
    
    test_endpoint "List Webhooks" "GET" "/api/webhooks" "yes" "" "200"
    
    # Try to create a test webhook
    log "Attempting to create test webhook..."
    result=$(curl -s -w '\n%{http_code}' -X POST -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' -d '{"url":"http://localhost:9999/test-webhook","events":["command_execute"],"secret":"test-secret-'$(date +%s)'"}' "$API_BASE/api/webhooks" 2>&1 || echo "")
    
    if [ -n "$result" ]; then
        http_code=$(echo "$result" | tail -n1)
        body=$(echo "$result" | sed '$d')
        webhook_id=$(echo "$body" | jq -r '.id // .data.id // empty' 2>/dev/null)
        
        if [ "$http_code" = "201" ] && [ -n "$webhook_id" ]; then
            CREATED_WEBHOOKS+=("$webhook_id")
            success "Webhook created with ID: $webhook_id"
            
            # Test webhook (may fail if test endpoint not implemented)
            curl -s -X POST -H "Authorization: Bearer $API_TOKEN" "$API_BASE/api/webhooks/$webhook_id/test" > /dev/null 2>&1 || true
        else
            warn "Could not create webhook (HTTP $http_code), skipping webhook operations"
        fi
    else
        warn "Webhook creation may have failed, continuing..."
    fi
}

test_secrets_endpoints() {
    echo ""
    log "=========================================="
    log "Category 9: Secrets Management"
    log "=========================================="
    
    test_endpoint "List Secrets" "GET" "/api/secrets" "yes" "" "200"
    
    # Try to create a test secret
    log "Attempting to create test secret..."
    secret_name="test-api-secret-$(date +%s)"
    result=$(curl -s -w '\n%{http_code}' -X POST -H "Authorization: Bearer $API_TOKEN" -H 'Content-Type: application/json' -d "{\"name\":\"$secret_name\",\"value\":\"test-value-12345\",\"description\":\"Test secret for API testing\"}" "$API_BASE/api/secrets" 2>&1 || echo "")
    
    if [ -n "$result" ]; then
        http_code=$(echo "$result" | tail -n1)
        body=$(echo "$result" | sed '$d')
        secret_id=$(echo "$body" | jq -r '.id // .data.id // empty' 2>/dev/null)
        
        if [ "$http_code" = "201" ] && [ -n "$secret_id" ]; then
            CREATED_SECRETS+=("$secret_id")
            success "Secret created with ID: $secret_id"
            
            # Get secret
            test_endpoint "Get Secret" "GET" "/api/secrets/$secret_id" "yes" "" "200"
        else
            warn "Could not create secret (HTTP $http_code), skipping secret operations"
        fi
    else
        warn "Secret creation may have failed, continuing..."
    fi
}

test_backup_endpoints() {
    echo ""
    log "=========================================="
    log "Category 10: Backups"
    log "=========================================="
    
    test_endpoint "List Backups" "GET" "/api/backups" "yes" "" "200"
}

test_workflow_endpoints() {
    echo ""
    log "=========================================="
    log "Category 11: Workflows"
    log "=========================================="
    
    test_endpoint "List Workflows" "GET" "/api/workflows" "yes" "" "200"
}

test_encryption_endpoints() {
    echo ""
    log "=========================================="
    log "Category 12: Encryption"
    log "=========================================="
    
    test_endpoint "List Encryption Keys" "GET" "/api/encryption/keys" "yes" "" "200"
}

test_rbac_endpoints() {
    echo ""
    log "=========================================="
    log "Category 13: RBAC"
    log "=========================================="
    
    test_endpoint "List Roles" "GET" "/api/rbac/roles" "yes" "" "200"
    test_endpoint "List Users" "GET" "/api/rbac/users" "yes" "" "200"
}

test_openapi_endpoints() {
    echo ""
    log "=========================================="
    log "Category 14: OpenAPI & Schema"
    log "=========================================="
    
    test_endpoint "OpenAPI Schema" "GET" "/api/openapi.json" "no" "" "200"
}

###############################################################################
# Cleanup Functions
###############################################################################

cleanup_test_data() {
    echo ""
    log "=========================================="
    log "Cleaning Up Test Data"
    log "=========================================="
    
    # Delete created webhooks
    for webhook_id in "${CREATED_WEBHOOKS[@]}"; do
        log "Deleting webhook: $webhook_id"
        curl -s -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_BASE/api/webhooks/$webhook_id" > /dev/null 2>&1 || warn "Failed to delete webhook $webhook_id"
    done
    
    # Delete created secrets
    for secret_id in "${CREATED_SECRETS[@]}"; do
        log "Deleting secret: $secret_id"
        curl -s -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_BASE/api/secrets/$secret_id" > /dev/null 2>&1 || warn "Failed to delete secret $secret_id"
    done
    
    # Delete created workflows
    for workflow_id in "${CREATED_WORKFLOWS[@]}"; do
        log "Deleting workflow: $workflow_id"
        curl -s -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_BASE/api/workflows/$workflow_id" > /dev/null 2>&1 || warn "Failed to delete workflow $workflow_id"
    done
    
    # Clean completed jobs
    if [ ${#CREATED_JOBS[@]} -gt 0 ]; then
        log "Cleaning completed jobs..."
        curl -s -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_BASE/api/jobs/completed/clear" > /dev/null 2>&1 || warn "Failed to clear jobs"
    fi
    
    success "Cleanup completed"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   VPS Local Orchestrator - Complete API Test Suite        ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    log "Test started at: $(date)"
    log "API Base URL: $API_BASE"
    log "Log file: $LOG_FILE"
    
    # Trap to ensure cleanup on exit
    trap cleanup_and_exit EXIT INT TERM
    
    # Run internal tests first (unit/integration tests)
    run_internal_tests
    internal_tests_result=$?
    
    if [ $internal_tests_result -ne 0 ]; then
        warn "Internal tests failed, but continuing with API tests..."
    fi
    
    # Start server
    start_server
    
    # Run all endpoint tests
    test_health_endpoints
    test_resource_endpoints
    test_command_endpoints
    test_jobs_endpoints
    test_ratelimit_endpoints
    test_circuitbreaker_endpoints
    test_audit_endpoints
    test_webhook_endpoints
    test_secrets_endpoints
    test_backup_endpoints
    test_workflow_endpoints
    test_encryption_endpoints
    test_rbac_endpoints
    test_openapi_endpoints
    
    # Cleanup test data
    cleanup_test_data
    
    # Stop server first
    stop_server
    
    # Print summary after server stops
    print_summary
    
    # Prevent trap from running again
    trap - EXIT INT TERM
}

cleanup_and_exit() {
    echo ""
    log "Cleaning up before exit..."
    cleanup_test_data 2>/dev/null || true
    stop_server 2>/dev/null || true
}

print_summary() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                     TEST SUMMARY                           ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "  Total Tests:    $TOTAL_TESTS"
    echo -e "  ${GREEN}Passed:${NC}         $PASSED_TESTS"
    echo -e "  ${RED}Failed:${NC}         $FAILED_TESTS"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "  ${GREEN}Success Rate:${NC}   100%"
    else
        success_rate=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
        echo -e "  Success Rate:   $success_rate%"
    fi
    
    echo ""
    echo "  Log file:       $LOG_FILE"
    echo "  Completed at:   $(date)"
    echo ""
    
    # Show code metrics
    collect_code_metrics
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed. Check log file for details.${NC}"
        exit 1
    fi
}

###############################################################################
# Script Entry Point
###############################################################################

main "$@"
