# Connect Windows emulator to Metro running in WSL
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "asinu-lite://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
