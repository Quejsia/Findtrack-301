import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { InfoPageShell } from "../components/layout/InfoPageShell";

const SUPPORT_EMAIL = "novapulsarsupport@gmail.com";

interface InfoPageProps {
  onHome: () => void;
}

export function AboutPage({ onHome }: InfoPageProps) {
  const { t } = useTranslation();
  return (
    <InfoPageShell title={t("landing.aboutUs")} onHome={onHome}>
      <p>
        FindTrack is a community-driven lost and found platform dedicated to
        helping people recover their lost items across the Philippines. Our
        mission is to foster a culture of honesty and trust (Bayanihan) by
        providing a secure and accessible platform for reporting and recovering
        lost belongings.
      </p>
      <p>
        Whether you've lost something precious or found an item that needs
        returning, FindTrack is here to bridge the gap and make recovery easier.
      </p>
    </InfoPageShell>
  );
}

const SAFETY_TIPS = [
  [
    "Meet in Public Places",
    "Always choose well-lit, public locations for handovers, such as cafes, malls, or police stations.",
  ],
  [
    "Bring a Friend",
    "If possible, bring someone with you when meeting a stranger.",
  ],
  [
    "Verify Ownership",
    "Ask identifying questions about the item before handing it over (e.g., unique marks, passwords for devices).",
  ],
  [
    "Do Not Share Personal Information",
    "Avoid sharing your home address, financial details, or other sensitive information.",
  ],
  [
    "Trust Your Instincts",
    "If a situation feels unsafe, cancel the meeting and report the user if necessary.",
  ],
];

export function SafetyPage({ onHome }: InfoPageProps) {
  const { t } = useTranslation();
  return (
    <InfoPageShell title={t("landing.safetyGuidelines")} onHome={onHome}>
      <p>
        Your safety is our top priority. When meeting to return or retrieve a
        lost item, please keep the following guidelines in mind:
      </p>
      <ul className="flex list-disc flex-col gap-3 pl-6">
        {SAFETY_TIPS.map(([label, text]) => (
          <li key={label}>
            <strong>{label}:</strong> {text}
          </li>
        ))}
      </ul>
    </InfoPageShell>
  );
}

const HELP_GUIDES = [
  {
    title: "How to Report a Lost Item",
    steps: [
      "Log in to your account and go to the Dashboard.",
      'Click on the "Report Item" button.',
      "Fill out the details (type, description, location) and upload a photo if available.",
      "Submit the report to alert the community.",
    ],
  },
  {
    title: "How to Claim a Found Item",
    steps: [
      "Browse the items feed on your Dashboard.",
      'If you spot an item that belongs to you, click "Claim item" (Hand icon).',
      "Provide proof of ownership in the message to the finder.",
      "Coordinate a safe handover.",
    ],
  },
];

export function HelpPage({ onHome }: InfoPageProps) {
  const { t } = useTranslation();
  return (
    <InfoPageShell title={t("landing.helpCenter")} onHome={onHome}>
      <p>Need assistance with using FindTrack? You're in the right place.</p>
      {HELP_GUIDES.map((guide) => (
        <section key={guide.title}>
          <h2 className="mb-3 text-xl font-bold text-slate-900">
            {guide.title}
          </h2>
          <ol className="list-decimal space-y-1 pl-6">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
      <p className="mt-10 border-t border-slate-200 pt-5">
        Still need help? Please reach out to our support team at:{" "}
        <strong>{SUPPORT_EMAIL}</strong>
      </p>
    </InfoPageShell>
  );
}

export function ContactPage({ onHome }: InfoPageProps) {
  const { t } = useTranslation();
  return (
    <InfoPageShell title={t("landing.contactUs")} onHome={onHome}>
      <p>
        We'd love to hear from you. Whether you have a question about our
        platform, need help with an item, or want to provide feedback, our team
        is ready to assist.
      </p>
      <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-6 text-green-800">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
          <Mail className="h-6 w-6" /> Email Support
        </h2>
        <p>
          You can reach our support team directly at:
          <br />
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-2 inline-block text-lg font-bold text-green-700 underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="mt-3 text-sm text-green-700">
          We typically respond within 24-48 hours.
        </p>
      </div>
    </InfoPageShell>
  );
}
