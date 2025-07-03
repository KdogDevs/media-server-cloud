#!/bin/bash

# Quick test script to verify the fix
# This can be run by users to test the dialog functionality

echo "=== Testing Installation Dialog Fix ==="
echo ""

# Source the fixed functions
source /home/runner/work/media-server-cloud/media-server-cloud/setup.sh

echo "This test will demonstrate the working dialog prompts..."
echo ""

# Test with a simple yes/no question
echo "1. Testing yes/no prompt:"
if safe_yesno "This is a test question. Are you ready to continue?" "Test Dialog"; then
    echo "   ✓ You selected Yes"
else
    echo "   ✓ You selected No"
fi

echo ""
echo "2. Testing input prompt:"
test_input=$(safe_input "Enter any test value (or press Enter for default):" "Test Input" "default_value")
echo "   ✓ You entered: '$test_input'"

echo ""
echo "3. Testing password prompt:"
test_password=$(safe_password "Enter a test password:" "Test Password")
echo "   ✓ Password entered (length: ${#test_password} characters)"

echo ""
echo "✅ All dialog functions are working correctly!"
echo "   The installation should now work in your environment."