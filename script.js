// ==================== CONFIGURATION ====================
// Update this with your actual backend URL
const API_BASE_URL = 'https://kish-payment-system-backend.onrender.com';

// Global variables
let currentTransaction = null;
let pollingInterval = null;
let pollAttempts = 0;
const MAX_POLL_ATTEMPTS = 30; // 30 attempts * 2 seconds = 60 seconds timeout

// ==================== DOM ELEMENTS ====================
const paymentForm = document.getElementById('paymentForm');
const paymentCard = document.getElementById('paymentCard');
const receiptCard = document.getElementById('receiptCard');
const statusCard = document.getElementById('statusCard');
const loadingState = document.getElementById('loadingState');
const payButton = document.getElementById('payButton');
const receiptDetails = document.getElementById('receiptDetails');
const downloadBtn = document.getElementById('downloadReceipt');
const newPaymentBtn = document.getElementById('newPayment');

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format phone number to required format (2547XXXXXXXX)
 * @param {string} phone - Raw phone input
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    }
    
    // If doesn't start with 254, add it
    if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
    }
    
    // Ensure it's 12 digits (254 + 9 digits)
    if (cleaned.length > 12) {
        cleaned = cleaned.substring(0, 12);
    }
    
    return cleaned;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function validatePhone(phone) {
    const formatted = formatPhoneNumber(phone);
    return /^2547[0-9]{8}$/.test(formatted);
}

/**
 * Validate amount
 * @param {number|string} amount - Amount to validate
 * @returns {boolean} True if valid
 */
function validateAmount(amount) {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 10 && num <= 150000;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {boolean} isError - Whether this is an error message
 */
function showToast(message, isError = false) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)'};
        backdrop-filter: blur(10px);
        padding: 1rem 1.5rem;
        border-radius: 12px;
        color: white;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        font-size: 0.9rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    toast.innerHTML = `
        <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Add animation style if not exists
    if (!document.querySelector('#toastAnimations')) {
        const style = document.createElement('style');
        style.id = 'toastAnimations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Reset UI to payment form
 */
function resetToPayment() {
    // Clear polling interval
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    // Reset UI visibility
    paymentForm.classList.remove('hidden');
    loadingState.classList.add('hidden');
    statusCard.classList.add('hidden');
    receiptCard.classList.add('hidden');
    
    // Enable pay button
    if (payButton) {
        payButton.disabled = false;
    }
    
    // Clear form
    const phoneInput = document.getElementById('phone');
    const amountInput = document.getElementById('amount');
    if (phoneInput) phoneInput.value = '';
    if (amountInput) amountInput.value = '';
    
    // Clear transaction data
    currentTransaction = null;
    pollAttempts = 0;
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return `KES ${parseFloat(amount).toLocaleString('en-KE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    })}`;
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ==================== PAYMENT HANDLERS ====================

/**
 * Handle payment form submission
 * @param {Event} e - Form submit event
 */
async function handlePaymentSubmit(e) {
    e.preventDefault();
    
    // Get form values
    const phoneInput = document.getElementById('phone').value.trim();
    const amountInput = document.getElementById('amount').value.trim();
    
    // Format phone
    const phone = formatPhoneNumber(phoneInput);
    
    // Validate inputs
    if (!validatePhone(phone)) {
        showToast('Please enter a valid Safaricom phone number (e.g., 0712345678 or 254712345678)', true);
        return;
    }
    
    if (!validateAmount(amountInput)) {
        showToast('Please enter a valid amount between KES 10 and KES 150,000', true);
        return;
    }
    
    // Show loading state
    paymentForm.classList.add('hidden');
    loadingState.classList.remove('hidden');
    
    // Disable pay button
    if (payButton) {
        payButton.disabled = true;
    }
    
    try {
        // Send STK push request to backend
        const response = await fetch(`${API_BASE_URL}/api/payment/stkpush`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                amount: parseInt(amountInput, 10)
            })
        });
        
        const data = await response.json();
        
        // Check if request was successful
        if (!response.ok) {
            throw new Error(data.message || 'Failed to initiate payment');
        }
        
        if (!data.success) {
            throw new Error(data.message || 'Payment initiation failed');
        }
        
        // Store transaction info
        currentTransaction = {
            transactionId: data.transactionId,
            phone: phone,
            amount: amountInput,
            checkoutRequestId: data.checkoutRequestId,
            merchantRequestId: data.merchantRequestId
        };
        
        // Hide loading, show status card
        loadingState.classList.add('hidden');
        statusCard.classList.remove('hidden');
        
        // Start polling for payment status
        startPolling(data.transactionId);
        
        showToast('STK Push sent! Check your phone to complete the payment');
        
    } catch (error) {
        console.error('Payment error:', error);
        showToast(error.message || 'Failed to initiate payment. Please try again.', true);
        
        // Reset UI
        paymentForm.classList.remove('hidden');
        loadingState.classList.add('hidden');
        
        if (payButton) {
            payButton.disabled = false;
        }
    }
}

/**
 * Start polling for payment status
 * @param {string} transactionId - Transaction ID to poll
 */
function startPolling(transactionId) {
    // Clear any existing polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    pollAttempts = 0;
    
    pollingInterval = setInterval(async () => {
        pollAttempts++;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/payment/status/${transactionId}`);
            const data = await response.json();
            
            if (!response.ok) {
                console.error('Status check failed:', data);
                
                if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    showToast('Unable to verify payment status. Please check your transaction history.', true);
                    resetToPayment();
                }
                return;
            }
            
            // Handle different statuses
            switch (data.status) {
                case 'SUCCESS':
                    // Payment successful
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    
                    // Update receipt with transaction details
                    updateReceipt(data.transaction);
                    
                    // Show receipt card
                    statusCard.classList.add('hidden');
                    receiptCard.classList.remove('hidden');
                    
                    if (payButton) {
                        payButton.disabled = false;
                    }
                    
                    showToast('Payment successful! Thank you for your payment.');
                    break;
                    
                case 'FAILED':
                    // Payment failed
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    
                    showToast(data.transaction?.resultDesc || 'Payment failed. Please try again.', true);
                    resetToPayment();
                    break;
                    
                case 'PENDING':
                    // Still pending, continue polling
                    if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        showToast('Payment timeout. Please check your transaction status later.', true);
                        resetToPayment();
                    }
                    break;
                    
                default:
                    console.log('Unknown status:', data.status);
            }
            
        } catch (error) {
            console.error('Polling error:', error);
            
            if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                showToast('Unable to verify payment status. Please check later.', true);
                resetToPayment();
            }
        }
    }, 2000); // Poll every 2 seconds
}

/**
 * Update receipt with transaction details
 * @param {Object} transaction - Transaction data from API
 */
function updateReceipt(transaction) {
    if (!transaction) return;
    
    const receiptHTML = `
        <div class="receipt-row">
            <span class="label">Transaction ID</span>
            <span class="value">${escapeHtml(transaction.transactionId)}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Phone Number</span>
            <span class="value">${escapeHtml(transaction.phone)}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Amount</span>
            <span class="value">${formatCurrency(transaction.amount)}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Date & Time</span>
            <span class="value">${formatDate(transaction.createdAt)}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Status</span>
            <span class="value ${transaction.status === 'SUCCESS' ? 'success' : ''}">
                ${transaction.status}
            </span>
        </div>
        ${transaction.mpesaReceiptNumber ? `
        <div class="receipt-row">
            <span class="label">M-Pesa Receipt</span>
            <span class="value">${escapeHtml(transaction.mpesaReceiptNumber)}</span>
        </div>
        ` : ''}
        ${transaction.resultDesc && transaction.status === 'FAILED' ? `
        <div class="receipt-row">
            <span class="label">Error Message</span>
            <span class="value failed">${escapeHtml(transaction.resultDesc)}</span>
        </div>
        ` : ''}
    `;
    
    if (receiptDetails) {
        receiptDetails.innerHTML = receiptHTML;
    }
    
    // Store complete transaction for PDF
    currentTransaction = transaction;
}

// ==================== PDF GENERATION ====================

/**
 * Download receipt as PDF
 */
async function downloadReceipt() {
    if (!currentTransaction) {
        showToast('No transaction data available', true);
        return;
    }
    
    // Show loading state on button
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
    downloadBtn.disabled = true;
    
    try {
        const { jsPDF } = window.jspdf;
        
        // Create PDF document
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Add header with gradient effect
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 210, 45, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('Kish Payment', 20, 28);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Official Payment Receipt', 20, 40);
        
        // Add receipt details
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        
        let yPos = 65;
        
        const details = [
            ['Transaction ID', currentTransaction.transactionId],
            ['Phone Number', currentTransaction.phone],
            ['Amount', formatCurrency(currentTransaction.amount)],
            ['Date & Time', formatDate(currentTransaction.createdAt)],
            ['Status', currentTransaction.status]
        ];
        
        if (currentTransaction.mpesaReceiptNumber) {
            details.push(['M-Pesa Receipt', currentTransaction.mpesaReceiptNumber]);
        }
        
        details.forEach(([label, value]) => {
            doc.setFont('helvetica', 'bold');
            doc.text(label + ':', 20, yPos);
            doc.setFont('helvetica', 'normal');
            
            // Handle long text wrapping
            const splitValue = doc.splitTextToSize(value, 100);
            doc.text(splitValue, 80, yPos);
            yPos += 12 * splitValue.length;
        });
        
        // Add footer
        yPos = Math.max(yPos + 20, 250);
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text('This is an official receipt from Kish Payment System', 20, yPos);
        doc.text('Secured by M-Pesa', 20, yPos + 7);
        doc.text(`Generated on: ${new Date().toLocaleString('en-KE')}`, 20, yPos + 14);
        
        // Add border
        doc.setDrawColor(124, 58, 237);
        doc.setLineWidth(0.5);
        doc.rect(10, 10, 190, 277);
        
        // Add watermark for authenticity
        doc.setFontSize(8);
        doc.setTextColor(200, 200, 200);
        doc.text('Digitally Verified', 150, 290);
        
        // Save PDF
        doc.save(`Kish_Receipt_${currentTransaction.transactionId}.pdf`);
        
        showToast('Receipt downloaded successfully!');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to generate receipt. Please try again.', true);
    } finally {
        // Restore button
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * View transactions (optional feature)
 */
function viewTransactions() {
    window.open(`${API_BASE_URL}/api/payment/transactions`, '_blank');
}

// ==================== INPUT FORMATTING ====================

/**
 * Auto-format phone input
 */
function setupPhoneInput() {
    const phoneInput = document.getElementById('phone');
    if (!phoneInput) return;
    
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 9) {
            value = value.substring(0, 9);
        }
        e.target.value = value;
    });
}

/**
 * Setup input focus effects
 */
function setupInputEffects() {
    document.querySelectorAll('.input-wrapper input').forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.borderColor = '#7C3AED';
            this.parentElement.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.2)';
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            this.parentElement.style.boxShadow = 'none';
        });
    });
}

// ==================== EVENT LISTENERS ====================

/**
 * Initialize all event listeners
 */
function initEventListeners() {
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadReceipt);
    }
    
    if (newPaymentBtn) {
        newPaymentBtn.addEventListener('click', resetToPayment);
    }
}

// ==================== INITIALIZATION ====================

/**
 * Initialize the application
 */
function init() {
    console.log('🚀 Kish Payment System initialized');
    console.log(`📡 API Base URL: ${API_BASE_URL}`);
    
    // Setup event listeners
    initEventListeners();
    
    // Setup input formatting
    setupPhoneInput();
    setupInputEffects();
    
    // Check backend connectivity (optional)
    fetch(`${API_BASE_URL}/health`)
        .then(response => response.json())
        .then(data => {
            console.log('✅ Backend is reachable:', data);
        })
        .catch(error => {
            console.warn('⚠️ Backend unreachable:', error.message);
            showToast('Unable to connect to payment server. Please check your connection.', true);
        });
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export functions for debugging (optional)
window.KishPayment = {
    formatPhoneNumber,
    validatePhone,
    validateAmount,
    resetToPayment,
    viewTransactions,
    getCurrentTransaction: () => currentTransaction,
    getApiBaseUrl: () => API_BASE_URL
};
