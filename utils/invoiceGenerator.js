const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateInvoice(order, user, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A4',
                margin: 50 
            });

            // Create write stream
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Header - Company Name
            doc.fontSize(24)
               .font('Helvetica-Bold')
               .text('LEAFORA', 50, 50);

            // Website URL (right aligned)
            doc.fontSize(10)
               .font('Helvetica')
               .text('www.leafora.com', 400, 55, { align: 'right' });

            // Horizontal line
            doc.moveTo(50, 85)
               .lineTo(550, 85)
               .stroke();

            // Invoice Details - Left Side
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .text('Invoice No:', 50, 100);
            
            doc.fontSize(10)
               .font('Helvetica')
               .text(order.orderId || 'N/A', 130, 100);

            doc.font('Helvetica-Bold')
               .text('Date:', 50, 115);
            
            doc.font('Helvetica')
               .text(new Date(order.createdOn).toLocaleDateString('en-GB'), 130, 115);

            // Order Status - Right Side
            doc.font('Helvetica-Bold')
               .text('Order Status:', 380, 100);
            
            doc.font('Helvetica')
               .text(getOverallOrderStatus(order), 470, 100);

            doc.font('Helvetica-Bold')
               .text('Payment Method:', 380, 115);
            
            doc.font('Helvetica')
               .text(order.paymentMethod.toUpperCase(), 490, 115);

            // Bill To Section
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .text('Bill To:', 50, 150);

            // Handle address properly - it's stored as Mixed type
            const address = order.address || {};
            
            doc.fontSize(10)
               .font('Helvetica')
               .text(address.name || user.name || 'N/A', 50, 165)
               .text(address.streetAddress || 'N/A', 50, 180)
               .text(address.city || 'N/A', 50, 195)
               .text(`${address.state || 'N/A'}, ${address.country || 'N/A'}`, 50, 210)
               .text(address.pincode || 'N/A', 50, 225);

            // Handle landmark if exists
            if (address.landMark) {
                doc.text(`Landmark: ${address.landMark}`, 50, 240);
                doc.text(`Phone: ${address.phone || 'N/A'}`, 50, 255);
                
                if (address.altPhone) {
                    doc.text(`Alt Phone: ${address.altPhone}`, 50, 270);
                }
            } else {
                doc.text(`Phone: ${address.phone || 'N/A'}`, 50, 240);
                
                if (address.altPhone) {
                    doc.text(`Alt Phone: ${address.altPhone}`, 50, 255);
                }
            }

            // Payment Verification Section - adjust Y position based on address length
            const paymentSectionY = address.altPhone ? 305 : (address.landMark ? 295 : 280);
            
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .fillColor('#0066CC')
               .text('PAYMENT VERIFICATION', 50, paymentSectionY);

            doc.fontSize(10)
               .fillColor('#000000')
               .text('Status: ', 50, paymentSectionY + 20);
            
            doc.font('Helvetica-Bold')
               .fillColor(order.paymentStatus === 'completed' ? '#27ae60' : '#e67e22')
               .text(order.paymentStatus.toUpperCase(), 90, paymentSectionY + 20);

            doc.fillColor('#000000')
               .font('Helvetica')
               .text(`Order ID: ${order.orderId}`, 50, paymentSectionY + 35);

            // Product Table Header - adjust based on previous sections
            const tableTop = paymentSectionY + 75;
            
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text('Product Name', 50, tableTop)
               .text('Qty', 280, tableTop)
               .text('Price', 330, tableTop)
               .text('Total', 390, tableTop)
               .text('Status', 450, tableTop);

            // Horizontal line under header
            doc.moveTo(50, tableTop + 15)
               .lineTo(550, tableTop + 15)
               .stroke();

            // Product Items
            let yPosition = tableTop + 25;
            
            order.orderedItems.forEach((item) => {
                doc.fontSize(9)
                   .font('Helvetica')
                   .text(item.productName || 'N/A', 50, yPosition, { width: 220 })
                   .text(item.quantity.toString(), 280, yPosition)
                   .text(`₹${item.price.toFixed(2)}`, 330, yPosition)
                   .text(`₹${(item.price * item.quantity).toFixed(2)}`, 390, yPosition)
                   .text(item.status.toUpperCase(), 450, yPosition);
                
                yPosition += 20;
            });

            // Totals Section (Right Aligned)
            yPosition += 20;

            const totalsX = 390;
            
            doc.fontSize(10)
               .font('Helvetica')
               .text('Subtotal:', totalsX, yPosition)
               .text(`₹${order.totalPrice.toFixed(2)}`, 480, yPosition);

            yPosition += 15;
            doc.text('Shipping Charge:', totalsX, yPosition)
               .text(`₹${order.deliveryCharge.toFixed(2)}`, 480, yPosition);

            // Coupon discount if applied
            if (order.couponApplied && order.couponDetails && order.couponDetails.discountAmount > 0) {
                yPosition += 15;
                doc.text('Coupon amt:', totalsX, yPosition)
                   .text(`-₹${order.couponDetails.discountAmount.toFixed(2)}`, 480, yPosition);
            }

            // // Product offer discount
            // if (order.discount > 0) {
            //     yPosition += 15;
            //     doc.text('Discount:', totalsX, yPosition)
            //        .text(`-₹${order.discount.toFixed(2)}`, 480, yPosition);
            // }

            yPosition += 20;
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .text('Final Amount:', totalsX, yPosition)
               .text(`₹${order.finalAmount.toFixed(2)}`, 480, yPosition);

            // Order Information Section
            yPosition += 40;
            
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor('#000000')
               .text('Order Information:', 50, yPosition);

            yPosition += 15;
            doc.fontSize(9)
               .font('Helvetica')
               .text('• Your order is currently being processed/shipped', 50, yPosition);

            yPosition += 12;
            doc.text('• Final cost calculations will be updated upon delivery completion', 50, yPosition);

            yPosition += 12;
            doc.text('• This invoice reflects your payment confirmation and current order status', 50, yPosition);

            // Smart Refund Information
            yPosition += 25;
            
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor('#e74c3c')
               .text('Smart Refund Information:', 50, yPosition);

            yPosition += 15;
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#000000')
               .text('• Refund amounts are calculated based on remaining valid items and coupon eligibility', 50, yPosition);

            yPosition += 12;
            doc.text('• If coupon minimum is not met after cancellation/return, discount will be removed', 50, yPosition);

            yPosition += 12;
            doc.text('• Refunds will be processed to your wallet/original payment method within 5-7 business days', 50, yPosition);

            if (order.couponApplied && order.couponDetails) {
                yPosition += 12;
                doc.fillColor('#0066CC')
                   .text(`• Coupon "${order.couponDetails.couponCode}" was applied to this order - refund amounts reflect coupon validity rules`, 50, yPosition, { width: 500 });
            }

            // Footer
            yPosition += 40;
            
            doc.fontSize(8)
               .fillColor('#666666')
               .text('Payment processed securely through Razorpay Gateway', 50, yPosition, { align: 'center', width: 500 });

            yPosition += 12;
            doc.text('Powered by Leafora', 50, yPosition, { align: 'center', width: 500 });

            yPosition += 12;
            doc.text('Thank you for shopping with us!', 50, yPosition, { align: 'center', width: 500 });

            yPosition += 12;
            doc.text('For any queries, contact us at support@leafora.com', 50, yPosition, { align: 'center', width: 500 });

            // Finalize PDF
            doc.end();

            stream.on('finish', () => {
                resolve(outputPath);
            });

            stream.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
}

// Helper function to get overall order status
function getOverallOrderStatus(order) {
    const statuses = order.orderedItems.map(item => item.status);
    
    // All delivered
    if (statuses.every(s => s === 'delivered')) {
        return 'DELIVERED';
    }
    
    // All cancelled
    if (statuses.every(s => s === 'cancelled')) {
        return 'CANCELLED';
    }
    
    // Mixed or in progress
    if (statuses.some(s => s === 'shipped' || s === 'out for delivery')) {
        return 'IN TRANSIT';
    }
    
    // Payment failed
    if (statuses.some(s => s === 'payment_failed')) {
        return 'PAYMENT FAILED';
    }
    
    return 'PROCESSING';
}

module.exports = { generateInvoice };