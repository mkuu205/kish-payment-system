const Transaction = require('../models/Transaction');
const mpesaService = require('../services/mpesa.service');
const PDFService = require('../utils/pdf.service');

class PaymentController {
  async initiatePayment(req, res, next) {
    try {
      const { phoneNumber, amount, description } = req.body;

      // Validate input
      if (!phoneNumber || !amount) {
        return res.status(400).json({
          error: 'Phone number and amount are required'
        });
      }

      // Validate phone number format (Kenyan)
      const phoneRegex = /^254[0-9]{9}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({
          error: 'Invalid phone number format. Use 254XXXXXXXXX'
        });
      }

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          error: 'Invalid amount'
        });
      }

      // Generate invoice number
      const invoiceNumber = Transaction.generateInvoiceNumber();

      // Create transaction record
      const transaction = new Transaction({
        phoneNumber,
        amount,
        invoiceNumber,
        status: 'pending',
        metadata: {
          description: description || 'Payment'
        }
      });

      await transaction.save();

      // Initiate STK Push
      const stkResponse = await mpesaService.initiateSTKPush(
        phoneNumber,
        amount,
        invoiceNumber,
        description
      );

      // Update transaction with M-Pesa details
      if (stkResponse.response) {
        transaction.merchantRequestId = stkResponse.response.MerchantRequestID;
        transaction.checkoutRequestId = stkResponse.response.CheckoutRequestID;
        transaction.responseCode = stkResponse.response.ResponseCode;
        transaction.responseDescription = stkResponse.response.ResponseDescription;
        transaction.customerMessage = stkResponse.response.CustomerMessage;
        
        if (stkResponse.response.ResponseCode !== 0) {
          transaction.status = 'failed';
        }
        
        await transaction.save();
      }

      res.status(200).json({
        success: true,
        data: {
          transactionId: transaction._id,
          invoiceNumber: transaction.invoiceNumber,
          merchantRequestId: transaction.merchantRequestId,
          checkoutRequestId: transaction.checkoutRequestId,
          status: transaction.status,
          message: transaction.customerMessage || 'Payment initiated successfully'
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req, res, next) {
    try {
      console.log('M-Pesa Callback Received:', req.body);
      
      const result = await mpesaService.handleCallback(req.body);

      res.status(200).json({
        success: true,
        message: 'Callback processed successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  async getTransactionStatus(req, res, next) {
    try {
      const { transactionId } = req.params;

      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          error: 'Transaction not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          transactionId: transaction._id,
          invoiceNumber: transaction.invoiceNumber,
          phoneNumber: transaction.phoneNumber,
          amount: transaction.amount,
          status: transaction.status,
          responseCode: transaction.responseCode,
          responseDescription: transaction.responseDescription,
          customerMessage: transaction.customerMessage,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt
        }
      });

    } catch (error) {
      next(error);
    }
  }

  async generateReceipt(req, res, next) {
    try {
      const { transactionId } = req.params;

      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          error: 'Transaction not found'
        });
      }

      if (transaction.status !== 'completed') {
        return res.status(400).json({
          error: 'Receipt can only be generated for completed transactions'
        });
      }

      // Generate PDF receipt
      const pdfBuffer = await PDFService.generateReceipt(transaction);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${transaction.invoiceNumber}.pdf`);
      res.send(pdfBuffer);

    } catch (error) {
      next(error);
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const { phoneNumber } = req.query;

      if (!phoneNumber) {
        return res.status(400).json({
          error: 'Phone number is required'
        });
      }

      const transactions = await Transaction.find({ phoneNumber })
        .sort({ createdAt: -1 })
        .limit(50);

      res.status(200).json({
        success: true,
        data: transactions
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
