const axios = require('axios');
const crypto = require('crypto');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortCode = process.env.MPESA_SHORTCODE;
    this.apiUrl = process.env.MPESA_API_URL;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    
    this.authToken = null;
    this.tokenExpiry = null;
  }

  // Generate access token
  async getAccessToken() {
    try {
      // Check if token is still valid
      if (this.authToken && this.tokenExpiry > Date.now()) {
        return this.authToken;
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(
        `${this.apiUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      this.authToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Subtract 1 minute for safety
      
      return this.authToken;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to get access token');
    }
  }

  // Generate password for STK push
  generatePassword(timestamp) {
    const businessShortCode = this.shortCode;
    const data = businessShortCode + this.passkey + timestamp;
    return Buffer.from(data).toString('base64');
  }

  // Initiate STK Push
  async stkPush(phoneNumber, amount, invoiceNumber, transactionDescription) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);

      // Format phone number (remove 0 or +254 if present)
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const requestBody = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount), // Ensure amount is integer
        PartyA: formattedPhone,
        PartyB: this.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: this.callbackUrl,
        AccountReference: invoiceNumber || 'KishPayment',
        TransactionDesc: transactionDescription || 'Payment for services'
      };

      const response = await axios.post(
        `${this.apiUrl}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('STK Push error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Query STK Push status
  async queryStatus(checkoutRequestID) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.generatePassword(timestamp);

      const requestBody = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(
        `${this.apiUrl}/mpesa/stkpushquery/v1/query`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Query status error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Helper: Get current timestamp in format YYYYMMDDHHmmss
  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  // Helper: Format phone number to international format
  formatPhoneNumber(phone) {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }
    // If starts with 7, add 254
    else if (cleaned.startsWith('7')) {
      cleaned = '254' + cleaned;
    }
    // If starts with 2547, keep as is
    else if (cleaned.startsWith('2547')) {
      cleaned = cleaned;
    }
    
    // Validate length (should be 12 digits: 254 + 9 digits)
    if (cleaned.length !== 12) {
      throw new Error('Invalid phone number format');
    }
    
    return cleaned;
  }
}

module.exports = new MpesaService();
