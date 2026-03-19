const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: String,
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  merchantRequestId: {
    type: String,
    sparse: true
  },
  checkoutRequestId: {
    type: String,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  responseCode: {
    type: String
  },
  responseDescription: {
    type: String
  },
  customerMessage: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Generate invoice number
transactionSchema.statics.generateInvoiceNumber = function() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

module.exports = mongoose.model('Transaction', transactionSchema);
