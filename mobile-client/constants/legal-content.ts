export const LEGAL_VERSION = '2026-04-15';

type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  effectiveDate: '04-15-2026',
  lastUpdated: '04-15-2026',
  sections: [
    {
      heading: '1. Overview',
      body: `This Privacy Policy explains how BigLemon LLC ("we," "our," or "us") collects, uses, discloses, and protects information when you use Arcs (the "App"), a sports analytics application focused on NBA-related content and insights.\n\nBy using the App, you agree to the practices described in this Privacy Policy.`,
    },
    {
      heading: '2. Information We Collect',
      body: `We may collect the following categories of information:\n\n• Account and profile information: first name, last name, and email address.\n• Authentication information: sign-in details if you register with Google Sign-In (we receive profile/account data permitted by Google and authorized by you).\n• Usage and analytics information: interactions with app features, pages/screens visited, session information, device/app diagnostics, and other application analytics used to improve the user experience.\n• Device and technical information: device type, operating system, app version, identifiers, and crash/error logs.`,
    },
    {
      heading: '3. How We Use Information',
      body: `We use your information to:\n\n• create and manage your account;\n• authenticate you and secure access to the App;\n• provide and improve features, performance, and reliability;\n• analyze usage trends to enhance user experience;\n• communicate important service updates and support responses;\n• detect, investigate, and prevent abuse, fraud, or unauthorized activity;\n• comply with applicable legal obligations.`,
    },
    {
      heading: '4. Analytics',
      body: `We collect application analytics to understand how users interact with the App and to improve functionality, usability, and performance. Analytics data may be collected directly by us or by service providers acting on our behalf.`,
    },
    {
      heading: '5. How We Share Information',
      body: `We do not sell your personal information. We may share information in the following circumstances:\n\n• Service providers: trusted vendors that host infrastructure, authentication, analytics, and support operations.\n• Legal compliance and protection: where required by law, regulation, subpoena, court order, or to protect rights, safety, and security.\n• Business transfers: in connection with a merger, acquisition, financing, or sale of assets, subject to customary confidentiality obligations.`,
    },
    {
      heading: '6. Data Retention',
      body: `We retain personal information for as long as reasonably necessary to provide the App, fulfill the purposes described in this Privacy Policy, comply with legal obligations, resolve disputes, and enforce agreements.`,
    },
    {
      heading: '7. Security',
      body: `We implement reasonable administrative, technical, and organizational safeguards to protect your information. However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.`,
    },
    {
      heading: '8. Your Choices and Rights',
      body: `Depending on your location and applicable law, you may have rights to access, update, correct, delete, or restrict processing of your personal information. You may also have the right to withdraw consent where processing is based on consent.\n\nTo exercise rights or request account deletion, contact us at: support@joinarcs.com.`,
    },
    {
      heading: "9. Children's Privacy",
      body: `The App is intended for adults in the United States and is not directed to individuals under 18. We do not knowingly collect personal information from children under 13 (or a higher age threshold where required by applicable law).`,
    },
    {
      heading: '10. International Users',
      body: `The App is intended for users in the United States. If you access the App from outside the United States, your information may be processed in countries where data protection laws differ from those in your jurisdiction.`,
    },
    {
      heading: '11. Changes to This Privacy Policy',
      body: `We may update this Privacy Policy from time to time. We will update the "Last Updated" date and, where required, provide additional notice.`,
    },
    {
      heading: '12. Contact',
      body: `If you have questions about this Privacy Policy, contact:\n\n• Email: support@joinarcs.com`,
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  title: 'Terms of Use',
  effectiveDate: '04-15-2026',
  lastUpdated: '04-15-2026',
  sections: [
    {
      heading: '1. Acceptance of Terms',
      body: `These Terms of Use ("Terms") govern your access to and use of Arcs (the "App"), operated by BigLemon LLC ("we," "our," or "us"). By accessing or using the App, you agree to be bound by these Terms.\n\nIf you do not agree to these Terms, do not use the App.`,
    },
    {
      heading: '2. Eligibility and Account Registration',
      body: `You must be at least 18 years old to use the App. You agree to provide accurate registration information, including first name, last name, and email address, and to keep your account information current.\n\nIf you register through Google Sign-In, you authorize us to access account information made available by Google in accordance with your permissions.`,
    },
    {
      heading: '3. App Purpose and No Betting Advice',
      body: `The App provides sports analytics, data visualizations, and informational content related to NBA games, teams, and players.\n\nThe App is for informational and entertainment purposes only. It does not provide financial, legal, investment, or gambling advice.`,
    },
    {
      heading: '4. No Guarantees; Assumption of Risk',
      body: `We do not guarantee the accuracy, completeness, timeliness, reliability, profitability, or suitability of any data, projections, rankings, insights, or other content in the App.\n\nAny betting, wagering, or financial decisions you make are solely your responsibility. You assume all risk for outcomes, including losses. Past performance, historical trends, or model outputs do not guarantee future results.`,
    },
    {
      heading: '5. Liability Disclaimer',
      body: `To the maximum extent permitted by law:\n\n• the App and all content are provided "as is" and "as available" without warranties of any kind, express or implied;\n• we disclaim all implied warranties, including merchantability, fitness for a particular purpose, title, and non-infringement;\n• we are not liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or any loss of profits, revenue, data, goodwill, business opportunities, or betting/wagering losses, arising from or related to your use of the App.\n\nWhere limitation of liability is not fully permitted by law, liability will be limited to the fullest extent permitted.`,
    },
    {
      heading: '6. Indemnification',
      body: `You agree to defend, indemnify, and hold harmless BigLemon LLC, its affiliates, officers, directors, employees, and agents from and against claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to:\n\n• your use or misuse of the App;\n• your violation of these Terms;\n• your violation of applicable laws, rules, or regulations;\n• your betting, wagering, or financial decisions made using App content.`,
    },
    {
      heading: '7. Responsible and Lawful Use',
      body: `You are responsible for complying with all laws applicable to sports betting, gambling, and online services in your jurisdiction. You may not use the App for unlawful, fraudulent, or abusive activity.`,
    },
    {
      heading: '8. Intellectual Property',
      body: `All App content, trademarks, logos, designs, software, and related materials are owned by or licensed to BigLemon LLC and are protected by applicable intellectual property laws. You may not copy, modify, distribute, reverse engineer, or create derivative works except as expressly permitted by law or with prior written consent.`,
    },
    {
      heading: '9. Third-Party Services and Links',
      body: `The App may integrate or link to third-party services (including authentication providers and analytics providers). We are not responsible for third-party products, services, content, or privacy practices.`,
    },
    {
      heading: '10. Suspension and Termination',
      body: `We may suspend or terminate access to the App at any time, with or without notice, for conduct that we reasonably believe violates these Terms, creates risk, or is otherwise harmful.`,
    },
    {
      heading: '11. Modifications',
      body: `We may modify these Terms at any time. Continued use of the App after updates become effective constitutes acceptance of the revised Terms.`,
    },
    {
      heading: '12. Governing Law and Venue',
      body: `These Terms are governed by the laws of the State of Michigan, United States, without regard to conflict-of-laws principles. Any dispute arising from these Terms or the App will be resolved exclusively in the state or federal courts located in Michigan, unless otherwise required by applicable law.`,
    },
    {
      heading: '13. Severability',
      body: `If any provision of these Terms is held invalid or unenforceable, the remaining provisions remain in full force and effect.`,
    },
    {
      heading: '14. Contact',
      body: `For legal notices or questions about these Terms:\n\n• Email: support@joinarcs.com`,
    },
  ],
};
