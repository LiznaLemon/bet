import { HeaderBackButton } from '@react-navigation/elements';
import { Stack, router } from 'expo-router';

export default function LegalLayout() {
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/sign-up');
  };

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLeft: (props) => <HeaderBackButton {...props} label="Close" onPress={handleClose} />,
      }}>
      <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of Use' }} />
    </Stack>
  );
}
