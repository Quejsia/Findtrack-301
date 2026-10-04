import { useTranslation } from "react-i18next";
import { LegalLayout } from "../../components/layout/LegalLayout";

interface PrivacyPageProps {
  onBack: () => void;
}

export default function PrivacyPage({ onBack }: PrivacyPageProps) {
  const { t } = useTranslation();

  return (
    <LegalLayout
      icon="🔒"
      title={t("landing.privacyPolicy")}
      lastUpdatedLabel="FindTrack Platform Security"
      onBack={onBack}
    >
      <div className="flex flex-col gap-6 text-sm leading-[1.7] text-white/85">
        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            1. Introduction
          </h3>
          <p>
            Welcome to FindTrack. We are dedicated to protecting your personal
            information and your right to privacy. This Privacy Policy describes
            how we collect, use, and process your information when you use our
            lost and found platform.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            2. Information We Collect
          </h3>
          <p>
            To provide our services, facilitate claiming, and enable safe
            communications, we collect the following personal details:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <strong>Account Credentials:</strong> Full name, verified email
              address, and profile pictures when you register.
            </li>
            <li>
              <strong>Contact Information:</strong> Phone numbers or social
              handle contact info you voluntarily provide so claimants/finders
              can get in touch with you.
            </li>
            <li>
              <strong>Item Reports Data:</strong> Item characteristics, dates,
              text descriptions, images of lost or found belongings, and exact
              or approximate locations where items were misplaced or recovered.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            3. How We Use Your Information
          </h3>
          <p>
            We process your personal information for purposes based on
            legitimate interests, the fulfillment of our services, and user
            convenience:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              To facilitate user account creation, profile management, and
              authentication check-ins.
            </li>
            <li>
              To list lost/found items and coordinate ownership claims between
              users.
            </li>
            <li>
              To send real-time alerts or email matchmaker suggestions and
              notifications about matching items.
            </li>
            <li>
              To provide direct communication channels specifically for
              coordinating item returns.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            4. Data Security &amp; Storage
          </h3>
          <p>
            Your account, contact profile information, and reported item details
            are safely stored using secure Cloud Firebase/Firestore
            infrastructure. Only authorized users can update their profiles or
            manage active items. We implement security protocols to protect your
            personal information against unauthorized retrieval, alteration, or
            disclosure.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            5. Your Rights &amp; Data Deletion
          </h3>
          <p>
            You can access, modify, or delete your personal contact coordinates
            at any time directly through the <strong>My Profile</strong> or{" "}
            <strong>My Items</strong> dashboards. If you wish to completely
            close your account or wipe your listing data, please reach out to
            our team or use the direct profile purge settings.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
