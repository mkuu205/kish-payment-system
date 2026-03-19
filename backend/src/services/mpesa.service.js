const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');

class MpesaService {
  constructor() {
    this.baseURL = process.env.MPESA_API_URL;
    this.routeCode = process.env.MPESA_ROUTE_CODE;
    this.operation = process.env.MPESA_OPERATION;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.apiKey = process.env.API_KEY;
  }

  generatePassword() {
    const timestamp = this.generateTimestamp();
    const data = `${this.shortcode}${this.passkey}${timestamp}`;
    const buffer = crypto.createHash('sha256').update(data).digest();
    return buffer.toString('base64');
  }

  generateTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  async initiateSTKPush(phoneNumber, amount, invoiceNumber, description = 'Payment') {
    try {
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword();

      const requestBody = {
        phoneNumber,
        amount: amount.toString(),
        invoiceNumber,
        sharedShortCode: false,
        orgShortCode: this.shortcode,
        orgPassKey: password,
        callbackUrl: this.callbackUrl,
        transactionDescription: description.substring(0, 13)
      };

      console.log('STK Push Request:', requestBody);

      const response = await axios.post(this.baseURL, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'routeCode': this.routeCode,
          'operation': this.operation,
          'messageId': `MSG-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          'apikey': this.apiKey
        }
      });

      console.log('STK Push Response:', response.data);

      return response.data;
    } catch (error) {
      console.error('STK Push Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async handleCallback(callbackData) {
    try {
      const { header, response } = callbackData;
      
      // Find transaction by invoice number (you'll need to store this mapping)
      // For now, we'll update based on some identifier in the response
      const transaction = await Transaction.findOne({ 
        merchantRequestId: response.MerchantRequestID 
      });

      if (transaction) {
        transaction.status = response.ResponseCode === 0 ? 'completed' : 'failed';
        transaction.checkoutRequestId = response.CheckoutRequestID;
        transaction.responseCode = response.ResponseCode;
        transaction.responseDescription = response.ResponseDescription;
        transaction.customerMessage = response.CustomerMessage;
        
        await transaction.save();
      }

      return {
        success: true,
        transaction
      };
    } catch (error) {
      console.error('Callback Error:', error);
      throw error;
    }
  }

  async checkTransactionStatus(checkoutRequestId) {
    // Implement status check if needed
    // This would query your database or call M-Pesa status API
    const transaction = await Transaction.findOne({ checkoutRequestId });
    return transaction;
  }
}

module.exports = new MpesaService();
