const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes
router.post('/stkpush', paymentController.initiatePayment);
router.post('/callback', paymentController.handleCallback);

// Protected routes
router.get('/transaction/:transactionId', authMiddleware, paymentController.getTransactionStatus);
router.get('/receipt/:transactionId', authMiddleware, paymentController.generateReceipt);
router.get('/history', authMiddleware, paymentController.getTransactionHistory);

module.exports = router;
