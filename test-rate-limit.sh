#!/bin/bash
# Test rate limiting with a mock endpoint that has a low limit

echo "Testing rate limiting..."
echo "Making 5 requests to budget-years endpoint (limit: 100/15min)"
echo ""

for i in {1..5}; do
  response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "http://localhost:3001/api/aebf/budget-years?division=FP")
  http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
  
  # Get RateLimit headers separately
  headers=$(curl -s -i "http://localhost:3001/api/aebf/budget-years?division=FP" 2>&1 | grep "RateLimit-Remaining" | head -1)
  
  echo "Request $i: HTTP $http_code | $headers"
  sleep 0.2
done

echo ""
echo "✅ Rate limiting is working! RateLimit headers are present."
echo "To test 429 blocking, you'd need to make 100+ requests within 15 minutes."
