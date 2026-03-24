import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';

// Called when Android deep link asinu-lite://auth/zalo/callback fires.
// maybeCompleteAuthSession() signals expo-web-browser to close the Chrome Custom Tab.
WebBrowser.maybeCompleteAuthSession();

export default function ZaloCallbackScreen() {
  return <View />;
}
