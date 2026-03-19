const PDFDocument = require('pdfkit');

class PDFService {
  async generateReceipt(transaction) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Header
        doc.fontSize(25)
           .fillColor('#2563eb')
           .text('Kish Payment', { align: 'center' })
           .moveDown();

        doc.fontSize(20)
           .fillColor('#000')
           .text('Payment Receipt', { align: 'center' })
           .moveDown(2);

        // Transaction details
        doc.fontSize(12)
           .fillColor('#374151');

        // Create a styled box for transaction details
        doc.roundedRect(50, doc.y, 500, 200, 10)
           .fillAndStroke('#f3f4f6', '#d1d5db');

        doc.fillColor('#111827')
           .text('Transaction Details', 70, doc.y + 20, { underline: true })
           .moveDown();

        doc.fontSize(11)
           .fillColor('#374151');

        const details = [
          `Invoice Number: ${transaction.invoiceNumber}`,
          `Transaction ID: ${transaction.checkoutRequestId || 'N/A'}`,
          `Phone Number: ${transaction.phoneNumber}`,
          `Amount: KES ${transaction.amount}`,
          `Status: ${transaction.status.toUpperCase()}`,
          `Date: ${transaction.createdAt.toLocaleDateString()}`,
          `Time: ${transaction.createdAt.toLocaleTimeString()}`
        ];

        details.forEach((detail, index) => {
          doc.text(detail, 70, doc.y + 10 + (index * 20));
        });

        // Footer
        const bottomY = 700;
        doc.fontSize(10)
           .fillColor('#6b7280')
           .text('This is a computer-generated receipt. No signature required.', 50, bottomY, { align: 'center' })
           .moveDown()
           .text('Thank you for your payment!', { align: 'center' });

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new PDFService();
