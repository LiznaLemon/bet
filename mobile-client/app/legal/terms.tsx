import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { TERMS_OF_USE } from '@/constants/legal-content';

export default function TermsOfUseScreen() {
  return <LegalDocumentScreen document={TERMS_OF_USE} />;
}
