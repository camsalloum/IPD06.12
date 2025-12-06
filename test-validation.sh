#!/bin/bash
echo "=== Testing AEBF Validation Across Multiple Endpoints ==="
echo ""

echo "1. Testing invalid division (should return 400):"
curl -s "http://localhost:3001/api/aebf/budget-years?division=INVALID" | jq -r '.error, .details[0].msg' 2>/dev/null | head -2

echo ""
echo "2. Testing missing required parameter (should return 400):"
curl -s "http://localhost:3001/api/aebf/budget" | jq -r '.error, .details[0].msg' 2>/dev/null | head -2

echo ""
echo "3. Testing invalid year format (should return 400):"
curl -s "http://localhost:3001/api/aebf/budget?division=FP&year=abc" | jq -r '.error, .details[0].msg' 2>/dev/null | head -2

echo ""
echo "4. Testing valid parameters but no DB (should return 500):"
curl -s "http://localhost:3001/api/aebf/budget-years?division=FP" | jq -r '.success, .error' 2>/dev/null | head -2

echo ""
echo "5. Testing filter-options endpoint:"
curl -s "http://localhost:3001/api/aebf/filter-options?division=FP" | jq -r '.success, .error' 2>/dev/null | head -2

echo ""
echo "=== Summary ==="
echo "✅ Tests 1-3 should show validation errors (400)"
echo "✅ Tests 4-5 should show database errors (500) - this is expected"
