#!/bin/bash

# Script to handle project path with special characters
# This script properly encodes the project path to avoid Metro bundler issues

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENCODED_PROJECT_ROOT=$(printf '%s' "$PROJECT_ROOT" | sed 's/ /%20/g')

echo "Starting Metro with encoded project root: $ENCODED_PROJECT_ROOT"

export REACT_NATIVE_PROJECT_ROOT="$ENCODED_PROJECT_ROOT"
export EXPO_PROJECT_ROOT="$ENCODED_PROJECT_ROOT"

npx expo start --clear