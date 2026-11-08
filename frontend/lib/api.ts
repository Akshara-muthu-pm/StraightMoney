import { mockCampaign, mockCampaigns, mockInvoices, mockLedger } from "./mockData";
import type { Campaign, CampaignAvailability, CampaignCreate, CampaignSummary, DeliveryCloseout, Donation, DonationStatus, DonorUpdate, Invoice, LedgerEntry, VerificationRequest } from "./types";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const body = payload as { detail?: unknown; message?: unknown };
  const detail = body.detail ?? body.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      if (typeof item === "object" && item !== null && "msg" in item) return String(item.msg);
      return String(item);
    }).join("; ");
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const isRead = !init?.method || init.method === "GET";
    response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", signal: init?.signal ?? AbortSignal.timeout(isRead ? 12000 : 180000) });
  } catch (cause) {
    if (path === "/campaigns" || /^\/campaigns\/\d+$/.test(path)) {
      throw new Error("Live campaigns are unavailable. Donation checkout is paused until the campaign service is running. Please try again shortly.");
    }
    if (path.includes("/donations") || path.endsWith("/donate")) {
      throw new Error(`Could not reach the donation API at ${API_URL}. Make sure the backend is running. If you already approved a PayPal payment, check the public ledger before trying again.`);
    }
    if (path.endsWith("/ledger/ask")) {
      throw new Error("Could not reach the ledger question service. Please try again shortly.");
    }
    if (cause instanceof Error && cause.name === "TimeoutError") {
      throw new Error("The API took too long to respond. Refresh the invoice before trying again; the payment may still be pending.");
    }
    throw new Error(`Could not reach the API at ${API_URL}. Refresh the invoice before trying again; approval may have been recorded.`);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500 && (path === "/campaigns" || /^\/campaigns\/\d+$/.test(path))) {
      throw new Error("Live campaigns are unavailable. Donation checkout is paused until the campaign service is running. Please try again shortly.");
    }
    throw new Error(errorMessage(body, `API request failed: ${response.status} ${response.statusText}`));
  }
  return body as T;
}

export const api = {
  currentAccount: (): Promise<{ id: number; email: string; name: string; role: "organizer" | "vendor" | "verifier" }> => request("/auth/me"),
  login: (email: string, password: string) => request<{ id: number; email: string; name: string; role: "organizer" | "vendor" | "verifier" }>("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }),
  registerAccount: (kind: "organizer" | "vendor" | "verifier", data: Record<string, string>) => request<{ id: number; email: string; name: string; role: "organizer" | "vendor" | "verifier" }>(`/auth/register-${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  logout: () => request<{ signed_out: boolean }>("/auth/logout", { method: "POST" }),
  myCampaigns: () => request<CampaignSummary[]>("/auth/my-campaigns"),
  myVendors: () => request<Array<{ id: number; campaign_id: number }>>("/auth/my-vendors"),
  myPendingInvites: () => request<Array<{
    invite_id: number;
    vendor_id: number;
    vendor_name: string;
    campaign_id: number;
    campaign_title: string;
    organizer_name: string;
    expires_at: string;
  }>>("/auth/my-pending-invites"),
  inviteVendor: (campaignId: number, vendorId: number) => request<{ email: string; invite_token: string; expires_in_days: number }>(`/auth/campaigns/${campaignId}/vendors/${vendorId}/invite`, { method: "POST" }),
  acceptVendorInvite: (inviteToken: string) => request<{ campaign_id: number; vendor_id: number }>("/auth/accept-vendor-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite_token: inviteToken }) }),
  claimCampaign: (campaignId: number, setupKey: string) => request<{ campaign_id: number; organizer: string }>(`/auth/campaigns/${campaignId}/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup_key: setupKey }) }),
  reconciliationIssues: () => request<Array<{ id: number; event_id: string; campaign_id: number | null; reference: string | null; detail: string; created_at: string }>>("/auth/reconciliation-issues"),
  listCampaigns: async (): Promise<CampaignSummary[]> => USE_MOCKS ? mockCampaigns : request<CampaignSummary[]>("/campaigns"),
  campaignAvailability: async (id: number): Promise<CampaignAvailability> => {
    if (!USE_MOCKS) return request<CampaignAvailability>(`/campaigns/${id}/availability`);
    const campaign = mockCampaigns.find((item) => item.id === id);
    if (!campaign) throw new Error("Campaign not found in demo data.");
    const raised = campaign.pool_balance + campaign.budget_lines.reduce((sum, line) => sum + line.paid_amount, 0);
    return { goal: campaign.goal_amount, status: campaign.status, raised, reserved: 0,
      remaining: Math.max(0, Math.round((campaign.goal_amount - raised) * 100) / 100) };
  },
  getCampaign: async (id: number): Promise<Campaign> => {
    if (USE_MOCKS) {
      const match = mockCampaigns.find((c) => c.id === id);
      return match ? match : Promise.reject(new Error("Campaign not found in demo data."));
    }
    return request<Campaign>(`/campaigns/${id}`);
  },
  getInvoices: async (campaignId?: number, status?: string): Promise<Invoice[]> => {
    if (USE_MOCKS) return mockInvoices.filter((invoice) => (campaignId === undefined || invoice.campaign_id === campaignId) && (!status || invoice.status === status));
    const query = new URLSearchParams();
    if (campaignId !== undefined) query.set("campaign_id", String(campaignId));
    if (status) query.set("status", status);
    return request<Invoice[]>(`/invoices${query.size ? `?${query}` : ""}`);
  },
  getInvoice: async (id: number): Promise<Invoice> => USE_MOCKS ? mockInvoices.find((invoice) => invoice.id === id)! : request<Invoice>(`/invoices/${id}`),
  getLedger: async (campaignId: number): Promise<LedgerEntry[]> => USE_MOCKS ? mockLedger : request<LedgerEntry[]>(`/campaigns/${campaignId}/ledger`),
  askLedger: (campaignId: number, question: string): Promise<{ answer: string }> => USE_MOCKS
    ? Promise.reject(new Error("Ledger questions need the live API and Gemini."))
    : request<{ answer: string }>(`/campaigns/${campaignId}/ledger/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }),
  assetUrl: (path: string | null): string | null => path && !USE_MOCKS ? `${API_URL}/${path.replace(/^\//, "")}` : null,
  createCampaign: (data: CampaignCreate): Promise<Campaign> => USE_MOCKS ? Promise.resolve(mockCampaign) : request<Campaign>("/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  cancelCampaign: (id: number, reason: string): Promise<Campaign> => request<Campaign>(`/campaigns/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }),
  organizerDonations: (id: number): Promise<Donation[]> => request<Donation[]>(`/campaigns/${id}/donations`),
  refundDonation: (id: number): Promise<Donation> => request<Donation>(`/donations/${id}/refund`, { method: "POST" }),
  createDonation: (campaignId: number, donor_name: string, amount: number, simulate: boolean = false): Promise<Donation> => USE_MOCKS ? Promise.resolve({ id: 99, campaign_id: campaignId, donor_name, amount, currency: "USD", paypal_order_id: `MOCK-ORDER-${Date.now()}`, source: simulate ? "simulated" : "paypal", status: "created", created_at: new Date().toISOString() }) : request<Donation>(`/campaigns/${campaignId}/donations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ donor_name, amount, simulate }) }),
  captureDonation: (orderId: string): Promise<Donation> => USE_MOCKS ? Promise.resolve({ id: 99, campaign_id: 1, donor_name: "Demo Donor", amount: 0, currency: "USD", paypal_order_id: orderId, source: "paypal", status: "captured", created_at: new Date().toISOString() }) : request<Donation>(`/donations/${orderId}/capture`, { method: "POST" }),
  releaseDonation: (orderId: string): Promise<Donation> => request<Donation>(`/donations/${encodeURIComponent(orderId)}/release`, { method: "POST" }),
  donationStatus: (orderId: string): Promise<DonationStatus> => request<DonationStatus>(`/donations/${encodeURIComponent(orderId)}/status`),
  donorUpdates: (orderId: string): Promise<DonorUpdate[]> => USE_MOCKS ? Promise.resolve([]) : request<DonorUpdate[]>(`/donations/${encodeURIComponent(orderId)}/updates`),
  campaignReportUrl: (campaignId: number): string => `${API_URL}/campaigns/${campaignId}/report.csv`,
  uploadInvoice: (form: FormData): Promise<Invoice> => USE_MOCKS ? Promise.resolve(mockInvoices[0]) : request<Invoice>("/invoices", { method: "POST", body: form }),
  reportDelivery: (id: number, delivered_description: string, delivered_at: string): Promise<DeliveryCloseout> => request<DeliveryCloseout>(`/invoices/${id}/delivery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delivered_description, delivered_at }) }),
  acceptDelivery: (id: number, remaining_issue: string): Promise<DeliveryCloseout> => request<DeliveryCloseout>(`/invoices/${id}/delivery/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remaining_issue }) }),
  approveInvoice: (id: number, data: VerificationRequest): Promise<Invoice> => USE_MOCKS ? Promise.resolve(mockInvoices[0]) : request<Invoice>(`/invoices/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  rejectInvoice: (id: number, data: VerificationRequest): Promise<Invoice> => USE_MOCKS ? Promise.resolve(mockInvoices[0]) : request<Invoice>(`/invoices/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  retryInvoice: (id: number, data: VerificationRequest): Promise<Invoice> => USE_MOCKS ? Promise.resolve(mockInvoices[0]) : request<Invoice>(`/invoices/${id}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
};
