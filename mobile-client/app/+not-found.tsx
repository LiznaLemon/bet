import { Redirect } from 'expo-router';

/**
 * Some auth providers may redirect to the bare app scheme (e.g. sportsstats:///).
 * Instead of showing an unmatched route screen, route back through the app root
 * so AuthGate can place the user in the correct destination.
 */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
