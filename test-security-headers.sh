#!/bin/bash

echo "=== Security Headers Verification ==="
echo ""

# Wait for server
sleep 4

# Test security headers
echo "Testing security headers on /health endpoint..."
HEADERS=$(curl -sI http://localhost:3001/health 2>&1)

echo ""
echo "Security Headers Found:"
echo "$HEADERS" | grep -i "x-frame-options" || echo "❌ X-Frame-Options: NOT FOUND"
echo "$HEADERS" | grep -i "x-content-type-options" || echo "❌ X-Content-Type-Options: NOT FOUND"
echo "$HEADERS" | grep -i "strict-transport-security" || echo "⚠️  Strict-Transport-Security: NOT FOUND (expected in development)"
echo "$HEADERS" | grep -i "x-xss-protection" || echo "❌ X-XSS-Protection: NOT FOUND"
echo "$HEADERS" | grep -i "referrer-policy" || echo "❌ Referrer-Policy: NOT FOUND"
echo "$HEADERS" | grep -i "x-permitted-cross-domain" || echo "❌ X-Permitted-Cross-Domain-Policies: NOT FOUND"
echo "$HEADERS" | grep -i "cache-control" || echo "❌ Cache-Control: NOT FOUND"
echo ""

# Check if X-Powered-By is hidden
if echo "$HEADERS" | grep -qi "x-powered-by"; then
  echo "⚠️  X-Powered-By header is still visible"
else
  echo "✅ X-Powered-By header is hidden"
fi

echo ""
echo "=== Rate Limiting Check ==="
echo "$HEADERS" | grep -i "x-ratelimit" || echo "⚠️  Rate limit headers not found on /health"

echo ""
echo "=== Server Status ==="
if lsof -ti:3001 > /dev/null 2>&1; then
  echo "✅ Server running on port 3001"
else
  echo "❌ Server not running"
fi
