import api from './api';

export class PayMongoService {

  // Creates a PayMongo Payment Link from an application ID
  // Payment record is only inserted in DB after payment is confirmed
  static async createPaymentLink(applicationId: number): Promise<{ checkoutUrl: string; linkId: string }> {
    try {
      const response = await api.post('/paymongo/create-payment-link', { application_id: applicationId });
      const checkoutUrl = response.data.checkout_url ?? null;
      const linkId      = response.data.link_id ?? null;
      if (!checkoutUrl || !linkId) {
        throw new Error('Missing checkout_url or link_id. Got: ' + JSON.stringify(response.data));
      }
      return { checkoutUrl, linkId };
    } catch (error: any) {
      throw new Error(error?.response?.data?.error || error?.message || 'Failed to create payment link');
    }
  }

  // Checks the status of a Payment Link — also triggers DB update to 'paid' if confirmed
  static async checkPaymentLinkStatus(linkId: string, applicationId: number): Promise<string> {
    try {
      const response = await api.get(`/paymongo/link-status?link_id=${linkId}&application_id=${applicationId}`);
      return response.data.status;
    } catch (error: any) {
      throw new Error(error?.response?.data?.error || 'Failed to check payment status');
    }
  }
}
