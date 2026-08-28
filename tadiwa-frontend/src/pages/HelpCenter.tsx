import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface FaqItem {
  question: string;
  steps: string[];
}

interface FaqCategory {
  title: string;
  items: FaqItem[];
}

// Sourced from the BSS SOP manual (helpdesk_browser_extension-main/BSS_steps.md)
// — one FAQ per procedure/troubleshooting section in that document.
const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: 'BSS Procedures',
    items: [
      {
        question: 'How do I add a basic or additional service to a prepaid line?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Navigate to Operations (end of the column with the phone number) and open the dropdown menu.',
          'Scroll down and select Modify Offer.',
          'Click Add (under Select Offer) and search for the desired service, e.g. GPRS (for bundles, if a D.A. already exists, click the copy icon after the bundle name).',
          'Tick the checkbox to mark the service and click Okay to confirm your selection.',
          "Under Order Reason, open the dropdown and select Other Reason.",
          'Enter the ticket ID or remarks for your order.',
          'Click Next to process your order.',
          "Tick the box to confirm the customer's order and click Next to complete it.",
          'For bundles: click Waiver, then Waiver with a 100% discount, add remarks, click Okay to waive, then click Next to process the order.',
        ],
      },
      {
        question: 'How do I deactivate a service on a number?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Navigate to Operations (end of the column with the phone number) and open the dropdown menu.',
          'Scroll down and select Modify Offer.',
          'Click the delete icon at the end of the row for the queried service.',
          'Under Order Reason, open the dropdown and select Other Reason.',
          'Enter the ticket ID or remarks for your order.',
          'Click Next to process your order.',
          "Tick the box to confirm the customer's order and click Next to complete it.",
        ],
      },
      {
        question: 'How do I do a SIM card replacement?',
        steps: [
          'Switch to the Econet back-office portal.',
          "If it's a normal card, authenticate the SIM card first.",
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Navigate to Operations (end of the column with the phone number) and open the dropdown menu.',
          'Click SIM Replacement.',
          'Enter the SIM card number / ICCID.',
          'Under Order Reason, open the dropdown and select Other Reason.',
          'Enter the ticket ID or remarks for your order.',
          "Tick the box to confirm the customer's order and click Next to complete it.",
          'Click Next to process your order.',
        ],
      },
      {
        question: "How do I adjust a customer's balance?",
        steps: [
          "Enter and query the customer's number on Account Receivable.",
          'Identify the queried balance/account and click Adjust.',
          'Enter the number of units, select the unit of measurement, add remarks/ticket ID (or change the window period), then click Ok to confirm.',
        ],
      },
      {
        question: 'How do I add a new account or D.A.?',
        steps: [
          "Enter and query the customer's number on Account Receivable.",
          'Select Add Account Balance.',
          'Use the Account Balance Type dropdown to pick the queried account type.',
          'Add the balance (e.g. 11) and select the unit of measurement for that account type.',
          'Select the effective date and expiry date to set the window period.',
          'Use the dropdown to select the suggested service number.',
          'Click Okay to create and complete the order.',
        ],
      },
      {
        question: 'How do I do a bundle conversion?',
        steps: [
          "Enter and query the customer's number on Account Receivable.",
          'Identify the queried balance/account and click Adjust.',
          'Enter the number of units, select the unit of measurement, add remarks/ticket ID (or change the window period), then click Ok to confirm.',
          'Select the correct currency and complete the adjustment (see balance adjustment steps).',
        ],
      },
      {
        question: 'How do I activate a one-way/two-way block (suspension or SIM lost)?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Navigate to Operations (end of the column with the phone number) and open the dropdown menu.',
          'Scroll down and select either Suspension Under Request or SIM Card Lost.',
          'Under Order Reason, open the dropdown and select the order reason.',
          'Enter the ticket ID or remarks for your order.',
          'Click Next to process your order.',
          "Tick the box to confirm the customer's order and click Next to complete it.",
        ],
      },
      {
        question: 'How do I deactivate a one-way/two-way block (reactivation/restore)?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Navigate to Operations (end of the column with the phone number) and open the dropdown menu.',
          'Scroll down and select Reactivation or Restore.',
          'Under Order Reason, open the dropdown and select the order reason.',
          'Enter the ticket ID or remarks for your order.',
          'Click Next to process your order.',
          "Tick the box to confirm the customer's order and click Next to complete it.",
        ],
      },
      {
        question: 'How do I check basic and additional services on a number?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Click on the queried phone number.',
          'Scroll down and select Additional Services to identify the service being queried.',
        ],
      },
      {
        question: 'How do I check for complete and hanging orders?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Click Order to view the orders.',
          'Click Detail to view detailed order information.',
        ],
      },
      {
        question: 'How do I reconnect a line?',
        steps: [
          'Switch to the Econet back-office portal.',
          "Enter and query the customer's number on Order Entry (individual portal).",
          "Compare the shared ICCID, ID number and customer's full name — proceed if details match.",
          'Open the system menu, expand Sales Inventory Center, and click SIM Card Lifecycle.',
          'Enter the ICCID in the FROM section, then click the TO tab to auto-populate the ICCID and query.',
          'Check the results: if the SIM is disabled, tick it and click Recycle then Ok to complete the order; if available, escalate to billing to change the state to inactive.',
          'Open the system menu, expand Sales Inventory Center, and click SIM Card Binding / Unbinding.',
          'Enter the phone number in the FROM and TO boxes, then click Service Number Quantity.',
          'Enter the ICCID in the FROM and TO boxes, then click Service Number Quantity.',
          'Click Query to load information.',
          'Click Bind to bind the ICCID and the phone number.',
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Click the house-like icon.',
          'Select the service class and order.',
          'Enter the ICCID and remarks, then click Next.',
          "Tick the box to confirm the customer's order and click Next to complete it — the number will go into an inactive state.",
          'On Order Entry, navigate to Operations and open the dropdown menu.',
          'Click PPS First Dial, click Next, and confirm the order to activate the SIM card.',
          'Authenticate the SIM card so it can attach to the network.',
        ],
      },
    ],
  },
  {
    title: 'Basic Troubleshooting',
    items: [
      {
        question: 'What do I do about a hanging or incomplete SIM replacement order?',
        steps: [
          "Enter and query the customer's number on Order Entry (individual portal).",
          'Click Order to view the order and its state.',
          'Open the system menu, expand Provisioning, then open Dispatch Order Query.',
          'Enter the service number with the 263 prefix, then click Query.',
          'Copy the dispatch order.',
          'Open the system menu, expand Provisioning, then click Online Work Order Query.',
          'Select the Abnormal Work Order tab, enter the dispatch order ID for your hanging order, and click Query.',
          "Double-click the order to see the check-out remarks (why it couldn't complete).",
          'If there is no authentication: authenticate the card on HLR, return to Abnormal Work Order Query, tick your order, click Redo, then check if it has been pushed.',
          'If a change-over was already initiated: use the HGIRI command on HLR, return to Abnormal Work Order Query, tick your order, click Redo, then check if it has been pushed.',
          'If IMSI Already Initiated or another error appears: check if the order has gone through HLR, then use Check In under Abnormal Order Query.',
        ],
      },
      {
        question: 'What do I check when a customer is failing to roam?',
        steps: [
          'Check if the customer is provisioned for roaming on cvBS.',
          'Check the customer has the correct roaming parameters (RSA) on HLR: RSA 2 — Prepaid Full Roaming, RSA 6 — Prepaid Voice & SMS, RSA 5 — Postpaid Voice & SMS, RSA 4 — Postpaid Full Roaming.',
          'Check that network addresses are not blocked or restricted (VLR, SGSN); reset if restricted.',
          'Check the country they are in — confirm we have roaming partners there.',
          'Check whether that country requires LTE roaming activation.',
          'If LTE roaming is active, verify all parameters are correct.',
          'Advise the customer to lock to 4G, then try manual network selection.',
          'Escalate to the roaming team — the issue may be with the partner network.',
        ],
      },
      {
        question: 'What do I check when a customer is failing to access USSD codes?',
        steps: [
          'Check the number is active (no one-way or two-way block).',
          'Check HLR for an OBSSM on the number; remove it with the SUD command if available.',
          "Advise the customer to try a different device, to rule out a handset issue.",
          'Advise the customer to do a SIM replacement and check if that resolves it.',
          'Escalate to VAS to check for possible blacklists (most cases without an OBSSM are a device or SIM issue).',
        ],
      },
      {
        question: 'What about a customer failing to buy bundles?',
        steps: [],
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.question}</span>
        <ChevronDown
          size={18}
          className={cn('shrink-0 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180 text-blue-600')}
        />
      </button>

      {isOpen && (
        <div className="px-6 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {item.steps.length > 0 ? (
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {item.steps.map((step, i) => (
                <li key={i} className="pl-1 leading-relaxed">{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-400 italic">No documented steps yet for this issue — escalate to a team lead.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpCenter() {
  const navigate = useNavigate();
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto py-12 animate-in zoom-in-95 duration-500">
      <div className="text-center mb-12">
        <HelpCircle className="mx-auto text-blue-600 mb-6" size={64} />
        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Need Help?</h2>
        <p className="text-slate-500 dark:text-slate-300 mb-8 leading-relaxed">Refer to the Econet Internal SOP Manual or ask Tadiwa for real-time guidance on any helpdesk issue.</p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20 transition-all"
        >
          Back to Hub
        </button>
      </div>

      <h3 className="text-xl font-bold mb-6 tracking-tight text-slate-900 dark:text-white">Frequently Asked Questions (FAQs)</h3>

      <div className="space-y-8">
        {FAQ_CATEGORIES.map((category) => (
          <div key={category.title}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">{category.title}</p>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden dark:bg-transparent dark:border-slate-600">
              {category.items.map((item) => {
                const key = `${category.title}:${item.question}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey((prev) => (prev === key ? null : key))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
