// API Configuration
const API_BASE_URL = window.location.origin; // This will use the same host as frontend
const API_KEY = 'test_api_key_123456';

// DOM Elements
const paymentCard = document.getElementById('paymentCard');
const statusCard = document.getElementById('statusCard');
const receiptCard = document.getElementById('receiptCard');

const paymentForm = document.getElementById('paymentForm');
const payButton = document.getElementById('payButton');

// Status elements
const statusIcon = document.getElementById('statusIcon');
const statusIconElement = document.getElementById('statusIconElement');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const transactionDetails = document.getElementById('transactionDetails');
const transactionId = document.getElementById('transactionId');
const transactionAmount = document.getElementById('transactionAmount');
const actionButtons = document.getElementById('actionButtons');
const loadingSpinner = document.getElementById('loadingSpinner');

// Receipt elements
const receiptTransactionId = document.getElementById('receiptTransactionId');
const receiptPhone = document.getElementById('receiptPhone');
const receiptAmount = document.getElementById('receiptAmount');
const receiptDate = document.getElementById('receiptDate');

// Buttons
const viewReceiptBtn = document.getElementById('viewReceiptBtn');
const newPaymentBtn = document.getElementById('newPaymentBtn');
const newFromReceiptBtn = document.getElementById('newFromReceiptBtn');
const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
const printReceiptBtn = document.getElementById('printReceiptBtn');

// API Status
const apiStatus = document.getElementById('apiStatus');
const apiStatusText = document.getElementById('apiStatusText');

// State
let currentTransaction = null;
let statusInterval = null;

// Check API connection on load
checkApiConnection();

// Event Listeners
paymentForm.addEventListener('submit', handlePaymentSubmit);
viewReceiptBtn.addEventListener('click', showReceipt);
newPaymentBtn.addEventListener('click', resetToPayment);
newFromReceiptBtn.addEventListener('click', resetToPayment);
downloadReceiptBtn.addEventListener('click', downloadReceipt);
printReceiptBtn.addEventListener('click', printReceipt);

// Format phone number to international format
function formatPhoneNumber(phone) {
    // Remove any non-digits
    const cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
        return '254' + cleaned.substring(1);
    }
    
    // If it's 9 digits, assume it's without country code
    if (cleaned.length === 9) {
        return '254' + cleaned;
    }
    
    return cleaned;
}

// Check API connection
async function checkApiConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/test`);
        if (response.ok) {
            apiStatus.className = 'api-status connected';
            apiStatusText.textContent = 'Connected';
            apiStatus.querySelector('i').className = 'fas fa-circle';
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        console.error('API connection error:', error);
        apiStatus.className = 'api-status disconnected';
        apiStatusText.textContent = 'Disconnected';
        apiStatus.querySelector('i').className = 'fas fa-circle';
    }
}

// Handle payment submission
async function handlePaymentSubmit(e) {
    e.preventDefault();
    
    const phoneInput = document.getElementById('phoneNumber').value;
    const amount = document.getElementById('amount').value;
    const description = document.getElementById('description').value;
    
    // Validate phone number
    if (!phoneInput) {
        showError('Please enter your phone number');
        return;
    }
    
    // Format phone number
    const phoneNumber = formatPhoneNumber(phoneInput);
    
    // Validate Kenyan phone number
    if (!phoneNumber.startsWith('254') || phoneNumber.length !== 12) {
        showError('Please enter a valid Kenyan phone number (e.g., 722000000)');
        return;
    }
    
    // Validate amount
    if (!amount || amount < 10) {
        showError('Please enter a valid amount (minimum KES 10)');
        return;
    }
    
    // Disable button and show loading
    payButton.disabled = true;
    payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Processing...</span>';
    
    try {
        console.log('Sending payment request:', { phoneNumber, amount, description });
        
        const response = await fetch(`${API_BASE_URL}/api/stkpush`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            },
            body: JSON.stringify({
                phoneNumber: phoneNumber,
                amount: amount,
                description: description || 'Payment'
            })
        });
        
        const data = await response.json();
        console.log('Payment response:', data);
        
        if (data.success) {
            currentTransaction = data.data;
            showStatusScreen();
            startStatusPolling();
        } else {
            throw new Error(data.error?.message || 'Payment initiation failed');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showError('Error: ' + error.message);
        resetToPayment();
    }
}

// Show error message
function showError(message) {
    alert(message);
}

// Show status screen
function showStatusScreen() {
    paymentCard.classList.add('hidden');
    statusCard.classList.remove('hidden');
    
    // Reset status UI
    statusIcon.className = 'status-icon status-pending';
    statusIconElement.className = 'fas fa-spinner fa-spin';
    statusTitle.textContent = 'Waiting for Payment...';
    statusMessage.textContent = 'Please check your phone and enter your M-Pesa PIN';
    transactionDetails.classList.add('hidden');
    actionButtons.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
}

// Start polling for status
function startStatusPolling() {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    
    statusInterval = setInterval(checkPaymentStatus, 3000);
}

// Check payment status
async function checkPaymentStatus() {
    if (!currentTransaction) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/transaction/${currentTransaction.transactionId}`, {
            headers: {
                'apikey': API_KEY
            }
        });
        
        const data = await response.json();
        console.log('Status check:', data);
        
        if (data.success) {
            const transaction = data.data;
            
            if (transaction.status === 'completed') {
                clearInterval(statusInterval);
                showSuccessStatus(transaction);
            } else if (transaction.status === 'failed') {
                clearInterval(statusInterval);
                showFailedStatus(transaction);
            }
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

// Show success status
function showSuccessStatus(transaction) {
    statusIcon.className = 'status-icon status-success';
    statusIconElement.className = 'fas fa-check-circle';
    statusTitle.textContent = 'Payment Successful!';
    statusMessage.textContent = 'Your payment has been processed successfully.';
    
    // Show transaction details
    transactionDetails.classList.remove('hidden');
    transactionId.textContent = transaction.transactionId;
    transactionAmount.textContent = `KES ${transaction.amount}`;
    
    // Hide loading spinner, show action buttons
    loadingSpinner.classList.add('hidden');
    actionButtons.classList.remove('hidden');
    
    currentTransaction = transaction;
}

// Show failed status
function showFailedStatus(transaction) {
    statusIcon.className = 'status-icon status-failed';
    statusIconElement.className = 'fas fa-times-circle';
    statusTitle.textContent = 'Payment Failed';
    statusMessage.textContent = transaction.customerMessage || 'Payment failed. Please try again.';
    
    // Hide loading spinner, show action buttons (only new payment)
    loadingSpinner.classList.add('hidden');
    actionButtons.classList.remove('hidden');
    viewReceiptBtn.classList.add('hidden');
}

// Show receipt
function showReceipt() {
    if (!currentTransaction) return;
    
    statusCard.classList.add('hidden');
    receiptCard.classList.remove('hidden');
    
    receiptTransactionId.textContent = currentTransaction.transactionId;
    receiptPhone.textContent = currentTransaction.phoneNumber;
    receiptAmount.textContent = `KES ${currentTransaction.amount}`;
    receiptDate.textContent = new Date().toLocaleDateString();
}

// Reset to payment screen
function resetToPayment() {
    paymentCard.classList.remove('hidden');
    statusCard.classList.add('hidden');
    receiptCard.classList.add('hidden');
    
    // Reset form
    document.getElementById('phoneNumber').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    
    // Reset button
    payButton.disabled = false;
    payButton.innerHTML = '<i class="fas fa-lock"></i><span>Pay Now</span>';
    
    // Clear interval
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    
    currentTransaction = null;
}

// Download receipt
async function downloadReceipt() {
    if (!currentTransaction) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/receipt/${currentTransaction.transactionId}`, {
            headers: {
                'apikey': API_KEY
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `receipt-${currentTransaction.invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            throw new Error('Failed to download receipt');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download receipt. Using browser print instead.');
        printReceipt();
    }
}

// Print receipt
function printReceipt() {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Kish Payment Receipt</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; }
                        .receipt { max-width: 500px; margin: 0 auto; }
                        h1 { color: #2563eb; }
                        .details { margin-top: 30px; }
                        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                        .amount { font-size: 24px; color: #2563eb; font-weight: bold; }
                        .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="receipt">
                        <h1>Kish Payment Receipt</h1>
                        <div class="details">
                            <div class="row">
                                <span>Transaction ID:</span>
                                <span>${receiptTransactionId.textContent}</span>
                            </div>
                            <div class="row">
                                <span>Phone Number:</span>
                                <span>${receiptPhone.textContent}</span>
                            </div>
                            <div class="row">
                                <span>Amount:</span>
                                <span class="amount">${receiptAmount.textContent}</span>
                            </div>
                            <div class="row">
                                <span>Date:</span>
                                <span>${receiptDate.textContent}</span>
                            </div>
                            <div class="row">
                                <span>Status:</span>
                                <span style="color: #10b981;">COMPLETED</span>
                            </div>
                        </div>
                        <div class="footer">
                            <p>Thank you for your payment!</p>
                            <p>For any queries, contact support@kishpayment.com</p>
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
}

// Periodically check API connection
setInterval(checkApiConnection, 30000); // Check every 30 seconds
