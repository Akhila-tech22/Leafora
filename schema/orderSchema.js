const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid'); // auto create order id 

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(), // see
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId, // id
            ref: 'Product',
            required: true
        },
        productName: { 
            type: String,
            required: true
        },
        productImage: { 
            type: String
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        regularPrice: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: [ 'ordered', 'shipped', 'out for delivery', 'delivered', 'cancelled', 'return_requested', 'approved', 'rejected','payment_failed'],
            default: 'ordered'
        },
        cancelReason: {
            type: String
        },
        returnReason: {
            type: String
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    deliveryCharge: {
        type: Number,
        default: 50
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.Mixed,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'online', 'wallet'],
        required: true
    },
    // Payment related fields
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    razorpayOrderId: {
        type: String
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    invoiceDate: {
        type: Date
    },
  
    returnImages: [{
        type: String
    }],
    requestStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionCategory: {
        type: String
    },
    rejectionReason: {
        type: String
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    updatedOn: {
        type: Date,
    },
    deliveredOn: {
        type: Date
    },
    // Coupon related fields
    couponApplied: {
        type: Boolean,
        default: false
    },
    couponDetails: {
        couponId: {
            type: Schema.Types.ObjectId,
            ref: 'Coupon'
        },
        couponCode: {
            type: String
        },
        discountAmount: {
            type: Number,
            default: 0
        }
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;