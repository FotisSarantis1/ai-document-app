/**
 * Text content for the bundled demo documents. Kept as plain data (not
 * binary PDFs) so the sample set is easy to read/review/edit directly in
 * source control, and is rendered into real PDFs on demand by pdfBuilder.
 */
export interface DemoDocSpec {
  filename: string;
  pages: string[];
}

export const DEMO_DOCUMENTS: DemoDocSpec[] = [
  {
    filename: "employee-handbook.pdf",
    pages: [
      `# Employee Handbook\n\nAcme Corporation\n\nThis handbook describes the policies and requirements that apply to all full-time and part-time employees of Acme Corporation. Employees are required to read this handbook within their first 30 days of employment and confirm receipt in writing to Human Resources.\n\n# Eligibility Requirements\n\nTo be eligible for benefits described in this handbook, an employee must:\n- Work a minimum of 20 hours per week\n- Complete a 90-day probationary period\n- Have a signed employment agreement on file with HR`,
      `# Leave and Vacation Policy\n\nFull-time employees accrue 20 days of paid vacation per calendar year. Vacation requests must be submitted at least 14 days in advance using the HR portal.\n\n# Important Deadlines\n\n- Open enrollment for health benefits closes on November 15 each year.\n- Timesheets are due every other Friday by 5:00 PM.\n- Annual performance reviews must be submitted by managers no later than March 1.\n- Unused vacation days must be requested for payout by December 31 or they are forfeited.`,
      `# Termination and Cancellation Policy\n\nEither the employee or Acme Corporation may terminate the employment relationship at any time, with or without cause, subject to applicable law.\n\nEmployees who wish to resign are asked to provide at least two weeks written notice to their manager and to HR.\n\nAcme Corporation may cancel an offer of employment or an employee's benefits enrollment within 30 days of a material misrepresentation on an application or enrollment form.\n\n# Contacts\n\nFor questions about this handbook, contact Priya Nair, Director of Human Resources, at hr@acmecorp.example.`,
    ],
  },
  {
    filename: "software-license-agreement.pdf",
    pages: [
      `# Software License Agreement\n\nThis Software License Agreement ("Agreement") is entered into between Acme Corporation ("Licensor") and the customer identified in the applicable order form ("Licensee").\n\n# Grant of License and Requirements\n\nLicensor grants Licensee a non-exclusive, non-transferable license to use the Software, subject to the following requirements:\n- Licensee must not exceed the number of authorized users listed in the order form.\n- Licensee must not reverse engineer, decompile, or resell the Software.\n- Licensee must maintain a current support contact on file with Licensor.`,
      `# Payment Terms and Deadlines\n\nLicense fees are invoiced annually in advance. Payment is due within 30 days of the invoice date. Invoices unpaid after 45 days may result in suspension of access to the Software.\n\nThe initial order must be signed and returned within 15 business days of the quote date for pricing to remain valid.`,
      `# Cancellation and Termination\n\nLicensee may cancel this Agreement by providing written notice at least 30 days before the renewal date. No refunds are issued for cancellations made after the renewal date has passed.\n\nLicensor may terminate this Agreement immediately if Licensee breaches the requirements described above and fails to cure the breach within 10 days of written notice.\n\nUpon cancellation or termination, Licensee must uninstall the Software and certify destruction of all copies within 5 business days.`,
      `# Contract Administration\n\nThe designated contract owner for Licensor is James Whitfield, VP of Customer Success. All notices under this Agreement must be sent in writing to legal@acmecorp.example.\n\nThis Agreement is governed by the laws of the state in which Licensor is headquartered.`,
    ],
  },
  {
    filename: "project-proposal.pdf",
    pages: [
      `# Project Proposal: Customer Portal Redesign\n\nPrepared for: Northwind Traders\nPrepared by: Acme Corporation Professional Services\n\n# Overview and Requirements\n\nThis proposal outlines the redesign of the Northwind Traders customer portal. Key requirements include:\n- Single sign-on integration with the existing identity provider\n- A responsive design that works on desktop, tablet, and mobile\n- Migration of all existing customer data without downtime\n- Accessibility compliance with WCAG 2.1 AA standards`,
      `# Timeline and Key Dates\n\n- Kickoff meeting: April 6\n- Design review milestone: May 4\n- Development complete: June 29\n- User acceptance testing: July 6 through July 17\n- Go-live deadline: July 31\n\nAny requested scope changes after the design review milestone may extend the go-live deadline.`,
      `# Budget and Obligations\n\nThe total estimated cost of this engagement is $184,000, billed monthly based on actual hours worked. Northwind Traders is responsible for providing timely access to test environments and for assigning a dedicated product owner, Sarah Klein, for the duration of the project.\n\nAcme Corporation is obligated to maintain a project status report delivered every Friday and to notify Northwind Traders within 48 hours of any identified risk to the go-live deadline.\n\nThe engagement lead for Acme Corporation is Marcus Alden, Senior Project Manager.`,
    ],
  },
];
