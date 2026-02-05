const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        required: true,
    },


    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },

    regularPrice: {
        type: Number,
        required: true
    },

    salePrice: {
        type: Number,
        required: true
    },

    productOffer: {
        type: Number,
        default: 0
    },
    effectiveOffer : {
        type : Number,
        default : 0
    },
    author: { type: String, required: true },


        quantity: {
                type: Number,
                required: true
            },

    productImage: [{
        type: String,
        required: true
    }],

    isBlocked: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ['available', 'out of stock', 'Discontinued'],
        required: true,
        default: 'available'
    },

    // Add the isPublished field
    isPublished: {
        type: Boolean,
        default: false // default value is false
    }

}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
