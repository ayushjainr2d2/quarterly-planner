import type { Idea, Source } from "../types";

interface SeedInput {
  id: string;
  title: string;
  description: string;
  source: Source;
  rawContext: string;
  theme: string;
  owner: string;
}

const raw: SeedInput[] = [
  {
    id: "i1",
    title: "SSO / SAML login for enterprise",
    description:
      "Support SAML-based single sign-on (SSO) so enterprise customers can log in via their own identity provider.",
    source: "sales",
    rawContext:
      "Deal size $180k, enterprise prospect (Northwind Logistics) blocked on procurement without SSO. Security team flagged churn risk on 2 existing enterprise accounts if this slips another quarter.",
    theme: "Security & Compliance",
    owner: "Priya",
  },
  {
    id: "i2",
    title: "Enterprise SSO login",
    description:
      "Enterprise customers want single sign-on (SSO) so they can log in via their own identity provider instead of email and password.",
    source: "jira",
    rawContext:
      "JIRA-4021. Filed by solutions engineering after 3 enterprise onboarding calls. No specific deal attached yet, general enterprise blocker.",
    theme: "Security & Compliance",
    owner: "Priya",
  },
  {
    id: "i3",
    title: "Slack integration for status change alerts",
    description:
      "Send a Slack alert when a workspace item's status changes, instead of making teams check the dashboard.",
    source: "slack",
    rawContext:
      "Thread in #feature-requests: 'would be great if we got a slack ping when something changes instead of checking the dashboard every hour' — 6 replies agreeing.",
    theme: "Integrations",
    owner: "Marcus",
  },
  {
    id: "i4",
    title: "Slack alerts for status changes",
    description:
      "Send Slack notifications when an item's status changes so teams don't have to check the dashboard constantly.",
    source: "support",
    rawContext:
      "38 tickets this month asking for Slack notifications, mostly from teams who say they miss status updates during the day.",
    theme: "Integrations",
    owner: "Marcus",
  },
  {
    id: "i5",
    title: "Two-factor authentication (2FA)",
    description: "Add TOTP-based 2FA as an optional security setting for all accounts.",
    source: "support",
    rawContext:
      "61 tickets this month, mostly from security-conscious admins after a competitor's breach made the news. A few explicitly cite compliance audits.",
    theme: "Security & Compliance",
    owner: "Priya",
  },
  {
    id: "i6",
    title: "Audit log for admin actions",
    description: "Give admins a searchable log of who changed what and when.",
    source: "exec",
    rawContext:
      "Raised by VP Sales after 3 customer meetings this month — two enterprise prospects specifically asked about audit trails during security review, both are 6-figure deals.",
    theme: "Security & Compliance",
    owner: "Priya",
  },
  {
    id: "i7",
    title: "Role-based permissions",
    description: "Let admins assign granular roles (viewer, editor, admin) instead of one shared permission level.",
    source: "sales",
    rawContext:
      "Deal size $95k. Enterprise prospect's IT lead won't sign without role separation between contributors and admins. Churn risk flagged on renewal for one existing account with the same ask.",
    theme: "Security & Compliance",
    owner: "Deepak",
  },
  {
    id: "i8",
    title: "Public webhooks",
    description: "Let customers subscribe to events via outbound webhooks for their own automation.",
    source: "jira",
    rawContext:
      "JIRA-3890, filed by a partner integrations engineer. No customer volume data attached — mostly a developer-platform bet.",
    theme: "Developer Platform",
    owner: "Jonathan",
  },
  {
    id: "i9",
    title: "Zapier integration",
    description: "Official Zapier app so non-technical users can wire up automations without webhooks.",
    source: "support",
    rawContext:
      "24 tickets this month, mostly small-business users asking to connect the app to Google Sheets and email tools.",
    theme: "Developer Platform",
    owner: "Jonathan",
  },
  {
    id: "i10",
    title: "Public API documentation site",
    description: "Standalone docs site with auth guides, endpoint reference, and code samples.",
    source: "other",
    rawContext: "Came up in a competitive teardown — top 3 competitors all have dedicated API docs sites, we don't.",
    theme: "Developer Platform",
    owner: "Jonathan",
  },
  {
    id: "i11",
    title: "Bulk edit for list items",
    description: "Select multiple rows and apply a status/owner/tag change in one action.",
    source: "support",
    rawContext:
      "52 tickets this month. Common complaint: 'I have to edit these one at a time' from teams managing large backlogs.",
    theme: "Collaboration",
    owner: "Ava",
  },
  {
    id: "i12",
    title: "Undo for destructive actions",
    description: "Show an undo toast for delete/bulk-delete so mistakes aren't permanent.",
    source: "slack",
    rawContext:
      "Support lead mentioned in #eng-support that this is the #1 'oh no' moment reported by new users, but no hard ticket count pulled yet.",
    theme: "Collaboration",
    owner: "Ava",
  },
  {
    id: "i13",
    title: "@mentions with comment threads",
    description: "Let users @mention teammates in comments and thread replies under an item.",
    source: "slack",
    rawContext:
      "Thread in #product: several customers on the same call this week asked why they can't tag each other, only assign owners.",
    theme: "Collaboration",
    owner: "Ava",
  },
  {
    id: "i14",
    title: "Keyboard shortcuts for power users",
    description: "Add a shortcut layer (j/k navigation, cmd+k command palette) for frequent users.",
    source: "other",
    rawContext: "Internal dogfooding note — our own team keeps asking for this, no external customer data.",
    theme: "Collaboration",
    owner: "Ava",
  },
  {
    id: "i15",
    title: "Scheduled recurring reports",
    description: "Let PMs schedule a report to auto-send to stakeholders weekly or monthly.",
    source: "sales",
    rawContext:
      "Deal size $62k. Mid-market prospect wants this to replace their manual weekly status email before they'll commit.",
    theme: "Reporting & Analytics",
    owner: "Marcus",
  },
  {
    id: "i16",
    title: "Custom fields in reports",
    description: "Allow admins to add and report on custom fields beyond the default schema.",
    source: "jira",
    rawContext: "JIRA-3654. Filed after 2 support escalations, details thin — needs scoping conversation with eng.",
    theme: "Reporting & Analytics",
    owner: "Deepak",
  },
  {
    id: "i17",
    title: "Export to BigQuery",
    description: "Native connector to sync data into a customer's BigQuery warehouse.",
    source: "exec",
    rawContext:
      "CEO ask after a competitor-analysis review — noted 2 competitors ship native warehouse connectors and we're being compared unfavorably in eval calls.",
    theme: "Reporting & Analytics",
    owner: "Deepak",
  },
  {
    id: "i18",
    title: "Dashboard performance for large workspaces",
    description: "Fix slow dashboard load times for workspaces with 5,000+ items.",
    source: "support",
    rawContext:
      "77 tickets this month, all from our largest accounts. Several mention load times over 20 seconds, a top churn-risk signal per CS.",
    theme: "Performance & Reliability",
    owner: "Jonathan",
  },
  {
    id: "i19",
    title: "Offline mode for mobile app",
    description: "Let the mobile app cache recent data and sync changes once back online.",
    source: "support",
    rawContext:
      "15 tickets this month, mostly field-sales users complaining about spotty connectivity during site visits.",
    theme: "Mobile",
    owner: "Ava",
  },
  {
    id: "i20",
    title: "Mobile push notifications",
    description: "Send push notifications for assignments and mentions on the mobile app.",
    source: "jira",
    rawContext: "JIRA-4102. Requested during mobile app v2 planning, no external ticket volume yet.",
    theme: "Mobile",
    owner: "Ava",
  },
  {
    id: "i21",
    title: "Usage-based billing tier",
    description: "New pricing tier that bills by active seats/usage instead of a flat rate.",
    source: "exec",
    rawContext:
      "CFO-driven initiative after finance review flagged flat pricing is leaving revenue on the table with our largest accounts — no specific deal, strategic bet.",
    theme: "Billing & Monetization",
    owner: "Marcus",
  },
  {
    id: "i22",
    title: "Multi-currency billing",
    description: "Support invoicing and billing in EUR/GBP alongside USD.",
    source: "sales",
    rawContext:
      "Deal size $140k. Enterprise prospect in Germany requires EUR invoicing for procurement, churn risk noted on 1 existing EU account frustrated with USD-only invoices.",
    theme: "Billing & Monetization",
    owner: "Marcus",
  },
  {
    id: "i23",
    title: "White-labeling / custom branding",
    description: "Let agencies remove our branding and apply their own logo/colors for client-facing views.",
    source: "sales",
    rawContext:
      "Deal size $48k. Agency partner prospect, mid-size, would sign faster with white-label but it's not a blocker.",
    theme: "Customization",
    owner: "Deepak",
  },
  {
    id: "i24",
    title: "Custom domains for shared views",
    description: "Allow customers to serve shared/public views from their own subdomain.",
    source: "other",
    rawContext: "Low-signal idea from a partner call, not yet validated with real customer demand.",
    theme: "Customization",
    owner: "Deepak",
  },
  {
    id: "i25",
    title: "In-app onboarding checklist",
    description: "Guided checklist for new accounts to reach first value faster.",
    source: "exec",
    rawContext:
      "Growth lead flagged after cohort analysis: accounts that complete 3+ setup steps in week 1 retain at 2x the rate. No specific deal, activation-metric driven.",
    theme: "Onboarding & Activation",
    owner: "Marcus",
  },
  {
    id: "i26",
    title: "Guided product tour on first login",
    description: "Short interactive tour highlighting the 3 core actions for a brand-new user.",
    source: "slack",
    rawContext:
      "Mentioned in standup by CS.",
    theme: "Onboarding & Activation",
    owner: "",
  },
  {
    id: "i27",
    title: "Dark mode",
    description: "System-aware dark theme across the app.",
    source: "slack",
    rawContext: "",
    theme: "Customization",
    owner: "",
  },
  {
    id: "i28",
    title: "HubSpot integration",
    description: "Two-way sync between HubSpot deals/contacts and workspace items.",
    source: "sales",
    rawContext:
      "Deal size $71k. Mid-market prospect uses HubSpot as source of truth, wants sync before renewal decision next quarter.",
    theme: "Integrations",
    owner: "Marcus",
  },
];

export const seedIdeas: Idea[] = raw.map((r) => ({
  ...r,
  scores: {},
  autoFilled: {},
  computedScore: 0,
  status: "unscored",
}));
