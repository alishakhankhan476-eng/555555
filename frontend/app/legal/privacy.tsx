import { LegalContainer, Section, Para, Bullets, SUPPORT_EMAIL } from "@/src/LegalDoc";

export default function PrivacyPolicy() {
  return (
    <LegalContainer title="Privacy Policy" updated="August 2025">
      <Para>
        This Privacy Policy explains what information Chatly (“Chatly,” “we,” “us”) handles when you use the
        Chatly messaging app, and how we use and protect it. We aim to collect only what is needed to run the
        app’s features. By using Chatly you agree to the practices described here.
      </Para>

      <Section n={1} title="Account Data">
        <Para>When you create an account we store the details you provide so you can sign in and be found by friends:</Para>
        <Bullets items={[
          "Your name, username, email address and optional bio.",
          "Your password, which is stored only in an encrypted (hashed) form — we never store it in plain text.",
          "A verification code sent to your email to confirm the account is yours.",
          "If you sign in with Google, we receive your basic profile (name, email, profile picture) to create your account.",
        ]} />
      </Section>

      <Section n={2} title="Profile Photos">
        <Para>
          If you add a profile photo, the image is stored with your account and shown to other users where you
          appear (chats, search, friend requests, statuses and your profile). You can change or remove your
          profile photo at any time from the Profile screen; removing it deletes the stored image from your account.
        </Para>
      </Section>

      <Section n={3} title="Messages and Chats">
        <Para>
          Chatly stores the messages, attachments (photos, documents and voice notes) and chat history needed to
          deliver your conversations across sessions and devices. Voice messages may be transcribed to text so you
          can read them. Messages are delivered to the people in the conversation and are not shown publicly.
        </Para>
      </Section>

      <Section n={4} title="Statuses (Text, Photo, Video)">
        <Para>
          Statuses you post are visible to your contacts for a limited time and automatically expire after 24 hours,
          after which they are removed. You can delete any of your own statuses before they expire. We keep a simple
          count of who has viewed your status so you can see its reach.
        </Para>
      </Section>

      <Section n={5} title="QR Codes and QR Scanning">
        <Para>
          Every account has a unique personal QR code that lets others add you quickly. The code contains only an
          opaque identifier linked to your account — it does not embed your email or password. Scanning uses your
          device camera solely to read a Chatly QR code; camera images are processed on-device and are not recorded
          or uploaded.
        </Para>
      </Section>

      <Section n={6} title="Friend Requests and Contacts">
        <Para>
          When you send or receive a friend request, or add a contact, we store that relationship so we can show the
          correct status (added, pending, or friends) and let you message each other. User search matches on names
          and usernames so people can find each other.
        </Para>
      </Section>

      <Section n={7} title="AI Features and Processing">
        <Para>
          Chatly offers optional AI features such as smart replies, chat summaries, translation, message insights and
          web research. When you use one of these features, the relevant text (for example the message or chat you
          chose) is sent to our AI providers to generate a response. This processing happens only when you trigger a
          feature. Please avoid sharing sensitive personal information in prompts you send to AI features.
        </Para>
      </Section>

      <Section n={8} title="Device Permissions">
        <Para>Chatly requests device permissions only for the features you use:</Para>
        <Bullets items={[
          "Camera — to scan QR codes and to capture photos/videos for chats and statuses.",
          "Photo library — to attach images and post photo/video statuses.",
          "Microphone — to record voice messages.",
        ]} />
        <Para>You can manage or revoke these permissions at any time in your device settings.</Para>
      </Section>

      <Section n={9} title="Data Storage and Retention">
        <Para>
          Your account information, messages, contacts and content are stored on our secured servers so the app can
          function. Statuses expire after 24 hours. Other content is retained while your account is active and is
          removed when you delete your account, except where we must keep limited records to comply with law.
        </Para>
      </Section>

      <Section n={10} title="Security">
        <Para>
          We use industry-standard safeguards to protect your data. Passwords are hashed, sign-in sessions use
          secure tokens stored safely on your device, and access to services is authenticated. No method of
          transmission or storage is 100% secure, but we work to protect your information and continually improve our
          protections.
        </Para>
      </Section>

      <Section n={11} title="Third-Party Services">
        <Para>
          To provide certain features we rely on trusted service providers, and only the data needed for that feature
          is shared with them:
        </Para>
        <Bullets items={[
          "AI providers (including Sarvam AI) to power smart replies, summaries and translation.",
          "A web-search provider (Tavily) to run research queries you request.",
          "An email provider to send account verification and security codes.",
          "Google, if you choose to sign in with your Google account.",
        ]} />
        <Para>These providers process data under their own terms and privacy policies.</Para>
      </Section>

      <Section n={12} title="Blocking">
        <Para>
          You can block another user at any time. Blocking stops messaging between you and that user. You can unblock
          later from the chat menu or their profile.
        </Para>
      </Section>

      <Section n={13} title="Account Deletion">
        <Para>
          You can delete your account from the Profile screen. Deleting your account removes your profile and
          associated content from active use. If you need help, contact us at {SUPPORT_EMAIL}.
        </Para>
      </Section>

      <Section n={14} title="Children’s Privacy">
        <Para>
          Chatly is not intended for children under 13 (or the minimum age required in your country). We do not
          knowingly collect data from children below that age.
        </Para>
      </Section>

      <Section n={15} title="Changes to This Policy">
        <Para>
          We may update this Privacy Policy from time to time. When we make material changes we will update the date
          above and, where appropriate, notify you in the app. Continued use of Chatly after changes means you accept
          the updated policy.
        </Para>
      </Section>
    </LegalContainer>
  );
}
