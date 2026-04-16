import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { PRIVACY_POLICY } from '@/constants/legal-content';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} />;
}
