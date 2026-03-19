// Configuration
const API_BASE_URL = 'http://localhost:5000'; // Update with your backend URL
let currentTransactionId = null;
let pollingInterval = null;

// DOM Elements
const paymentForm = document.getElementById('paymentForm');
const paymentCard = document.getElementById('paymentCard');
const receiptCard = document.getElementById('receiptCard');
const statusCard = document.getElementById('statusCard');
const loadingState = document.getElementById('loadingState');
const payButton = document.getElementById('payButton');
const receiptDetails = document.getElementById('receiptDetails');
const downloadBtn = document.getElementById('downloadReceipt');
const newPaymentBtn = document.getElementById('newPayment');

// Event Listeners
paymentForm.addEventListener('submit', handlePaymentSubmit);
downloadBtn.addEventListener('click', downloadReceipt);
newPaymentBtn.addEventListener('click', resetToPayment);

// Format phone number to required format (2547XXXXXXXX)
function formatPhoneNumber(phone) {
    // Remove any non-digit characters
    phone = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (phone.startsWith('0')) {
        phone = '254' + phone.substring(1);
    }
    
    // If doesn't start with 254, add it
    if (!phone.startsWith('254')) {
        phone = '254' + phone;
    }
    
    // Ensure it's 12 digits (254 + 9 digits)
    if (phone.length > 12) {
        phone = phone.substring(0, 12);
    }
    
    return phone;
}

// Validate phone number
function validatePhone(phone) {
    const formatted = formatPhoneNumber(phone);
    return /^2547[0-9]{8}$/.test(formatted);
}

// Validate amount
function validateAmount(amount) {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 10 && num <= 150000;
}

// Handle payment submission
async function handlePaymentSubmit(e) {
    e.preventDefault();
    
    // Get form values
    const phoneInput = document.getElementById('phone').value.trim();
    const amountInput = document.getElementById('amount').value.trim();
    
    // Format phone
    const phone = formatPhoneNumber(phoneInput);
    
    // Validate
    if (!validatePhone(phone)) {
        alert('Please enter a valid Safaricom phone number (e.g., 0712345678 or 254712345678)');
        return;
    }
    
    if (!validateAmount(amountInput)) {
        alert('Please enter a valid amount between KES 10 and KES 150,000');
        return;
    }
    
    // Show loading state
    paymentForm.classList.add('hidden');
    loadingState.classList.remove('hidden');
    payButton.classList.add('loading');
    
    try {
        // Send STK push request
        const response = await fetch(`${API_BASE_URL}/stkpush`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: phone,
                amount: amountInput
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to initiate payment');
        }
        
        // Store transaction ID and show status card
        currentTransactionId = data.transactionId;
        
        // Hide loading, show status card
        loadingState.classList.add('hidden');
        statusCard.classList.remove('hidden');
        
        // Start polling for status
        startPolling(currentTransactionId);
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Failed to initiate payment: ' + error.message);
        
        // Reset UI
        paymentForm.classList.remove('hidden');
        loadingState.classList.add('hidden');
        payButton.classList.remove('loading');
    }
}

// Start polling for payment status
function startPolling(transactionId) {
    let attempts = 0;
    const maxAttempts = 60; // Poll for 2 minutes (60 * 2 seconds)
    
    pollingInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch(`${API_BASE_URL}/status/${transactionId}`);
            const data = await response.json();
            
            if (data.status === 'completed') {
                // Payment successful
                clearInterval(pollingInterval);
                
                // Update receipt with transaction details
                updateReceipt(data.transaction);
                
                // Show receipt card
                statusCard.classList.add('hidden');
                receiptCard.classList.remove('hidden');
                
            } else if (data.status === 'failed' || attempts >= maxAttempts) {
                // Payment failed or timeout
                clearInterval(pollingInterval);
                
                alert('Payment timed out or failed. Please try again.');
                
                // Reset to payment form
                resetToPayment();
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}

// Update receipt with transaction details
function updateReceipt(transaction) {
    const date = new Date(transaction.timestamp);
    const formattedDate = date.toLocaleString('en-KE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    receiptDetails.innerHTML = `
        <div class="receipt-row">
            <span class="label">Transaction ID</span>
            <span class="value">${transaction.transactionId}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Phone Number</span>
            <span class="value">${transaction.phone}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Amount</span>
            <span class="value">KES ${parseFloat(transaction.amount).toLocaleString()}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Date & Time</span>
            <span class="value">${formattedDate}</span>
        </div>
        <div class="receipt-row">
            <span class="label">Status</span>
            <span class="value success">SUCCESS</span>
        </div>
    `;
}

// Download receipt as PDF
function downloadReceipt() {
    const { jsPDF } = window.jspdf;
    
    // Get receipt data
    const rows = document.querySelectorAll('.receipt-row');
    const data = {};
    
    rows.forEach(row => {
        const label = row.querySelector('.label').textContent;
        const value = row.querySelector('.value').textContent;
        data[label] = value;
    });
    
    // Create PDF
    const doc = new jsPDF();
    
    // Add header
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Kish Payment', 20, 25);
    
    doc.setFontSize(12);
    doc.text('Payment Receipt', 20, 35);
    
    // Add receipt details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    let yPos = 60;
    Object.entries(data).forEach(([key, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(key + ':', 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 80, yPos);
        yPos += 10;
    });
    
    // Add footer
    yPos = 250;
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('This is an official receipt from Kish Payment System', 20, yPos);
    doc.text('Secured by M-Pesa', 20, yPos + 7);
    doc.text(new Date().toLocaleDateString(), 20, yPos + 14);
    
    // Add border
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);
    
    // Save PDF
    doc.save(`Kish_Receipt_${data['Transaction ID'] || Date.now()}.pdf`);
}

// Reset to payment form
function resetToPayment() {
    // Clear any polling
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    // Reset UI
    paymentForm.classList.remove('hidden');
    loadingState.classList.add('hidden');
    statusCard.classList.add('hidden');
    receiptCard.classList.add('hidden');
    payButton.classList.remove('loading');
    
    // Clear form
    document.getElementById('phone').value = '';
    document.getElementById('amount').value = '';
    
    // Clear transaction ID
    currentTransactionId = null;
}

// Auto-format phone input
document.getElementById('phone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 9) {
        value = value.substring(0, 9);
    }
    e.target.value = value;
});

// Add floating label effect
document.querySelectorAll('.input-wrapper input').forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
        if (!this.value) {
            this.parentElement.classList.remove('focused');
        }
    });
});

// Initialize
console.log('Kish Payment System initialized');
