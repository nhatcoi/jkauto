#!/bin/bash

# Target API URL
API_URL="http://localhost:3001"

echo "=== 1. Checking API Health ==="
curl -s -X GET "$API_URL/health" | node -e '
  try {
    const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    console.log("Status:", data.status);
    console.log("Uptime:", data.uptime);
    console.log("Timestamp:", data.timestamp);
  } catch(e) {
    console.log("Error checking health. Is server running on port 3001?");
  }
'
echo ""

echo "=== 2. Logging in as Admin ==="
LOGIN_RES=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123"}')

echo "Login Response:"
echo "$LOGIN_RES" | node -e '
  try {
    const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.log("Raw response:", require("fs").readFileSync(0, "utf-8"));
  }
'

TOKEN=$(echo "$LOGIN_RES" | node -e '
  try {
    const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    console.log(data.accessToken || "");
  } catch (e) {
    console.log("");
  }
')

if [ -z "$TOKEN" ]; then
  echo "Failed to retrieve access token. Make sure the server is running."
  exit 1
fi

echo "Access Token retrieved successfully."
echo ""

echo "=== 3. Getting System Statistics (Authenticated) ==="
curl -s -X GET "$API_URL/stats" \
  -H "Authorization: Bearer $TOKEN" | node -e '
  try {
    const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.log("Error fetching stats.");
  }
'
echo ""

echo "=== 4. Creating a New Document (Authenticated) ==="
NEW_DOC=$(curl -s -X POST "$API_URL/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Document via cURL", "description": "Created via test-api.sh script", "status": "draft"}')

echo "Created Document:"
echo "$NEW_DOC" | node -e '
  try {
    const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.log("Error creating document.");
  }
'

DOC_ID=$(echo "$NEW_DOC" | node -e '
  try {
    const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    console.log(data.id || "");
  } catch (e) {
    console.log("");
  }
')
echo ""

if [ -n "$DOC_ID" ]; then
  echo "=== 5. Fetching the Created Document by ID ==="
  curl -s -X GET "$API_URL/documents/$DOC_ID" \
    -H "Authorization: Bearer $TOKEN" | node -e '
    try {
      const data = JSON.parse(require("fs").readFileSync(0, "utf-8"));
      console.log(JSON.stringify(data, null, 2));
    } catch(e) {
      console.log("Error fetching document.");
    }
  '
  echo ""
fi
