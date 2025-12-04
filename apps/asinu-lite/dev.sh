#!/bin/bash
set -e

cd ~/asinu/apps/asinu-lite
EXPO_NO_ADB=1 npx expo start --dev-client --clear --host localhost
