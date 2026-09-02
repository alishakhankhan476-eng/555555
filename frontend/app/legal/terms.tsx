import { LegalContainer, Section, Para, Bullets, SUPPORT_EMAIL } from "@/src/LegalDoc";

export default function Terms() {
  return (
    <LegalContainer title="Terms &amp; Conditions" updated="August 2025">
      <Para>
        These Terms &amp; Conditions (“Terms”) govern your use of the Chatly messaging app. By creating an account
        or using Chatly, you agree to these Terms. If you do not agree, please do not use the app.
      </Para>

      <Section n={1} title="Eligibility and Accounts">
        <Para>
          You must be at least 13 years old (or the minimum age required in your country) to use Chatly. You are
          responsible for the information you provide, for keeping your password secure, and for all activity that
          happens under your account. Verify your email when prompted so we can confirm the account is yours.
        </Para>
      </Section>

      <Section n={2} title="Using Chatly">
        <Para>Chatly lets you connect and communicate. Core features include:</Para>
        <Bullets items={[
          "Sending messages and attachments (photos, documents and voice notes).",
          "Posting text, photo and video statuses that expire after 24 hours.",
          "Adding people via user search, friend requests, or your unique QR code.",
          "Optional AI tools such as smart replies, summaries, translation and web research.",
        ]} />
      </Section>

      <Section n={3} title="AI Features">
        <Para>
          AI features are provided to assist you and may not always be accurate, complete or appropriate. AI output
          is generated automatically and should not be relied upon as professional, legal, medical or financial
          advice. You are responsible for reviewing AI suggestions before you send or act on them.
        </Para>
      </Section>

      <Section n={4} title="Acceptable Use">
        <Para>When using Chatly, you agree not to:</Para>
        <Bullets items={[
          "Harass, threaten, impersonate, or harm others, or send spam or unsolicited bulk messages.",
          "Post or share content that is illegal, hateful, sexually exploitative, or violates others’ rights.",
          "Upload malware, attempt to disrupt the service, or gain unauthorized access to accounts or systems.",
          "Collect or misuse other users’ information, including through QR codes or search.",
          "Use Chatly for any unlawful purpose or in violation of these Terms.",
        ]} />
      </Section>

      <Section n={5} title="Your Content and Responsibilities">
        <Para>
          You retain ownership of the content you create and share. You are solely responsible for your content and
          confirm you have the right to share it. You grant Chatly the limited permission needed to store and deliver
          your content to the people you send it to, and to operate features you use (for example, expiring statuses).
        </Para>
      </Section>

      <Section n={6} title="Blocking and Reporting">
        <Para>
          You can block any user to stop messaging between you. If you encounter abuse or content that violates these
          Terms, please report it to us at {SUPPORT_EMAIL} so we can review and take appropriate action.
        </Para>
      </Section>

      <Section n={7} title="Privacy">
        <Para>
          Your use of Chatly is also governed by our Privacy Policy, which explains what information we handle and how.
          Please review it to understand our data practices.
        </Para>
      </Section>

      <Section n={8} title="Account Suspension and Termination">
        <Para>
          You may delete your account at any time from the Profile screen. We may suspend or terminate accounts that
          violate these Terms or that create risk or legal exposure for Chatly or its users. On termination, your
          right to use the app ends.
        </Para>
      </Section>

      <Section n={9} title="Service Availability and Disclaimers">
        <Para>
          Chatly is provided on an “as is” and “as available” basis. We do not guarantee that the app will be
          uninterrupted, error-free, or that messages and AI features will always be available or accurate. Features
          may change or be discontinued as the app evolves.
        </Para>
      </Section>

      <Section n={10} title="Limitation of Liability">
        <Para>
          To the maximum extent permitted by law, Chatly and its providers are not liable for indirect, incidental,
          or consequential damages, or for loss of data or content, arising from your use of — or inability to use —
          the app.
        </Para>
      </Section>

      <Section n={11} title="Third-Party Services">
        <Para>
          Chatly uses third-party providers for AI, web search, email verification and optional Google sign-in. Your
          use of features that rely on these providers may also be subject to their terms.
        </Para>
      </Section>

      <Section n={12} title="Changes to the Service and Terms">
        <Para>
          We may update these Terms as Chatly grows or as legal requirements change. When we make material changes we
          will update the date above and, where appropriate, notify you in the app. Continued use after changes means
          you accept the updated Terms.
        </Para>
      </Section>
    </LegalContainer>
  );
}
