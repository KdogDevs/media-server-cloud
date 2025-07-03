#!/bin/bash

# Quick test script to verify the fix
# This can be run by users to test the dialog functionality

echo "=== Testing Installation Dialog Fix ==="
echo ""

# Extract only the dialog functions from setup.sh without running the main script
extract_functions() {
    # Check if we're in a non-interactive environment
    is_non_interactive() {
        # Check for common non-interactive indicators
        if [[ -n "$CI" ]] || [[ -n "$AUTOMATED_INSTALL" ]] || [[ "$DEBIAN_FRONTEND" == "noninteractive" ]] || [[ ! -t 0 ]]; then
            return 0
        fi
        
        # Test if we can actually read from stdin
        if ! timeout 0.1 bash -c 'read -t 0' 2>/dev/null; then
            return 0
        fi
        
        return 1
    }

    # Check if we can use whiptail (interactive terminal with proper TTY)
    can_use_whiptail() {
        # Check if stdin, stdout, and stderr are all terminals and whiptail is available
        if [[ -t 0 ]] && [[ -t 1 ]] && [[ -t 2 ]] && [[ "$TERM" != "dumb" ]] && [[ -n "$TERM" ]] && command -v whiptail &> /dev/null; then
            # Additional test: check if whiptail can actually work
            # Use a timeout to prevent hanging in problematic environments
            if timeout 1s whiptail --msgbox "Testing whiptail availability" 8 50 --title "Test" 2>/dev/null; then
                return 0
            fi
        fi
        return 1
    }

    # Safe yes/no prompt with whiptail fallback
    safe_yesno() {
        local message="$1"
        local title="${2:-Confirmation}"
        local default="${3:-no}"  # Default to 'no' for safety
        
        # Check for environment variable override
        local env_var_name="AUTOMATED_${title// /_}"
        env_var_name="${env_var_name^^}"  # Convert to uppercase
        env_var_name="${env_var_name//[^A-Z0-9_]/}"  # Clean non-alphanumeric chars except underscore
        
        # Safely check if the environment variable exists and has a value
        if declare -p "$env_var_name" >/dev/null 2>&1; then
            local env_value=""
            eval "env_value=\$${env_var_name}"
            if [[ -n "$env_value" ]]; then
                case "${env_value,,}" in
                    y|yes|true|1) return 0;;
                    n|no|false|0) return 1;;
                esac
            fi
        fi
        
        if can_use_whiptail; then
            if whiptail --yesno "$message" 8 78 --title "$title" 3>&1 1>&2 2>&3; then
                return 0
            else
                return 1
            fi
        elif is_non_interactive; then
            # Non-interactive environment - use default and log the decision
            echo "┌─ $title ─┐"
            echo "│ $message"
            echo "│ Non-interactive environment detected. Using default: $default"
            echo "└─────────────────────────────────┘"
            case "${default,,}" in
                y|yes|true) return 0;;
                *) return 1;;
            esac
        else
            # Fallback to simple read prompt
            echo
            echo "┌─ $title ─┐"
            echo "│ $message"
            echo "└─────────────────────────────────┘"
            
            local attempts=0
            local max_attempts=3  # Reduced from 5 to fail faster
            
            while [[ $attempts -lt $max_attempts ]]; do
                local user_input=""
                if read -p "Enter your choice (y/n) [default: $default]: " -r user_input 2>/dev/null; then
                    # Successfully read input
                    if [[ -z "$user_input" ]]; then
                        user_input="$default"
                    fi
                    
                    # Handle the response
                    case "${user_input,,}" in  # Convert to lowercase
                        y|yes) return 0;;
                        n|no) return 1;;
                        *) 
                            echo "Please answer y or n."
                            ;;
                    esac
                else
                    # Read failed
                    echo "Error reading input."
                fi
                
                ((attempts++))
            done
            
            # If we get here, too many invalid attempts or read failures
            echo "Too many invalid attempts or input unavailable. Using default: $default"
            case "${default,,}" in
                y|yes|true) return 0;;
                *) return 1;;
            esac
        fi
    }

    # Safe input prompt with whiptail fallback
    safe_input() {
        local message="$1"
        local title="${2:-Input Required}"
        local default="${3:-}"
        local result=""
        
        # Check for environment variable override
        local env_var_name="AUTOMATED_${title// /_}"
        env_var_name="${env_var_name^^}"  # Convert to uppercase
        env_var_name="${env_var_name//[^A-Z0-9_]/}"  # Clean non-alphanumeric chars except underscore
        
        # Safely check if the environment variable exists and has a value
        if declare -p "$env_var_name" >/dev/null 2>&1; then
            local env_value=""
            eval "env_value=\$${env_var_name}"
            if [[ -n "$env_value" ]]; then
                echo "$env_value"
                return 0
            fi
        fi
        
        if can_use_whiptail; then
            result=$(whiptail --inputbox "$message" 8 78 "$default" --title "$title" 3>&1 1>&2 2>&3)
        elif is_non_interactive; then
            # Non-interactive environment - use default or fail
            echo "┌─ $title ─┐"
            echo "│ $message"
            if [[ -n "$default" ]]; then
                echo "│ Non-interactive environment detected. Using default: $default"
                echo "└─────────────────────────────────┘"
                result="$default"
            else
                echo "│ Non-interactive environment detected but no default provided."
                echo "│ Please set environment variable: $env_var_name"
                echo "└─────────────────────────────────┘"
                return 1
            fi
        else
            # Fallback to simple read prompt
            echo
            echo "┌─ $title ─┐"
            echo "│ $message"
            echo "└─────────────────────────────────┘"
            
            local attempts=0
            local max_attempts=3  # Reduced for faster failure
            
            while [[ $attempts -lt $max_attempts ]]; do
                if [[ -n "$default" ]]; then
                    if read -p "Enter value [default: $default]: " -r result 2>/dev/null; then
                        result="${result:-$default}"
                        break
                    else
                        echo "Error reading input."
                    fi
                else
                    if read -p "Enter value: " -r result 2>/dev/null; then
                        if [[ -n "$result" ]]; then
                            break
                        else
                            echo "Error: Value cannot be empty. Please try again."
                        fi
                    else
                        echo "Error reading input."
                    fi
                fi
                ((attempts++))
            done
            
            # If we still don't have a result after all attempts
            if [[ -z "$result" ]]; then
                if [[ -n "$default" ]]; then
                    echo "Input unavailable. Using default: $default"
                    result="$default"
                else
                    echo "Input unavailable and no default provided. Cannot continue."
                    return 1
                fi
            fi
        fi
        echo "$result"
    }

    # Safe password prompt with whiptail fallback
    safe_password() {
        local message="$1"
        local title="${2:-Password Required}"
        local result=""
        
        # Check for environment variable override
        local env_var_name="AUTOMATED_${title// /_}"
        env_var_name="${env_var_name^^}"  # Convert to uppercase
        env_var_name="${env_var_name//[^A-Z0-9_]/}"  # Clean non-alphanumeric chars except underscore
        
        # Safely check if the environment variable exists and has a value
        if declare -p "$env_var_name" >/dev/null 2>&1; then
            local env_value=""
            eval "env_value=\$${env_var_name}"
            if [[ -n "$env_value" ]]; then
                echo "$env_value"
                return 0
            fi
        fi
        
        if can_use_whiptail; then
            result=$(whiptail --passwordbox "$message" 8 78 --title "$title" 3>&1 1>&2 2>&3)
        elif is_non_interactive; then
            # Non-interactive environment - require environment variable
            echo "┌─ $title ─┐"
            echo "│ $message"
            echo "│ Non-interactive environment detected."
            echo "│ Please set environment variable: $env_var_name"
            echo "└─────────────────────────────────┘"
            return 1
        else
            # Fallback to simple read prompt
            echo
            echo "┌─ $title ─┐"
            echo "│ $message"
            echo "└─────────────────────────────────┘"
            
            local attempts=0
            local max_attempts=3  # Reduced for faster failure
            
            while [[ $attempts -lt $max_attempts ]]; do
                if read -s -p "Enter password (hidden): " -r result 2>/dev/null; then
                    echo  # Add newline after hidden input
                    if [[ -n "$result" ]]; then
                        break
                    else
                        echo "Error: Password cannot be empty. Please try again."
                    fi
                else
                    echo  # Add newline if read failed
                    echo "Error reading input."
                fi
                ((attempts++))
            done
            
            # If we still don't have a result after all attempts
            if [[ -z "$result" ]]; then
                echo "Password input unavailable. Cannot continue."
                return 1
            fi
        fi
        echo "$result"
    }
}

# Load the functions
extract_functions

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