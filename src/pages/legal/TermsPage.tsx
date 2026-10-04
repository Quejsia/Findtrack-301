import { useTranslation } from "react-i18next";
import { LegalLayout } from "../../components/layout/LegalLayout";

interface TermsPageProps {
  onBack: () => void;
}

export default function TermsPage({ onBack }: TermsPageProps) {
  const { t } = useTranslation();

  return (
    <LegalLayout
      icon="⚖️"
      title={t("landing.termsOfService")}
      lastUpdatedLabel="FindTrack Community Terms"
      onBack={onBack}
    >
      <div className="flex flex-col gap-6 text-sm leading-[1.7] text-white/85">
        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            1. Agreement to Terms
          </h3>
          <p>
            By registering, logging in, browsing as a guest, or submitting
            reports on FindTrack, you accept and agree to follow these Terms of
            Service. If you do not agree to all of these Terms, you are
            prohibited from using the application.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            2. User Responsibilities &amp; Acceptable Use
          </h3>
          <p>
            When posting lost or found items and interacting with other
            community members, you agree to:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              Provide accurate, genuine, and reliable details regarding found
              objects, locations, and descriptions.
            </li>
            <li>
              Refrain from listing fraudulent claims, fake items, offensive
              photos, or inaccurate contact information.
            </li>
            <li>
              Respect other users and use the interactive real-time coordinates,
              chats, and claims desk only for legitimate recovery purposes.
            </li>
            <li>
              Never attempt to gain unauthorized access to other user profiles,
              databases, or restricted platform APIs.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            3. Verification of Ownership &amp; Meetups
          </h3>
          <p>
            FindTrack provides verification mechanisms (such as custom security
            confirmation questions) to help confirm proof of ownership prior to
            release. However:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              Users are solely responsible for thoroughly vetting proof of
              ownership before handing over items.
            </li>
            <li>
              Physical meetups, handling of high-value items, and exchanges are
              at your own discretion. We encourage coordinating safe, public,
              well-lit spaces (such as security desk areas, campuses, or
              official lost and found centers).
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            4. Disclaimer of Warrant &amp; Limitation of Liability
          </h3>
          <p>
            FindTrack is provided "as is" and "as available". We do not
            guarantee that your lost items will be found, or that matches
            suggested by the system are 100% correct. Under no circumstances
            shall FindTrack, our developers, or our affiliates be liable for
            damages, item damage, theft, fraud, or any conflicts arising from
            physical item exchange coordinates.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-base font-bold text-sky-400">
            5. Modifications to Service
          </h3>
          <p>
            We reserves the right to modify or adjust the features, layouts,
            database rules, or services of FindTrack at any time. Continued use
            of the platform after updates indicates consent to all revised
            guidelines.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
