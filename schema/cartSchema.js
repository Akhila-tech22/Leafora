const mongoose = require('mongoose');
const {Schema} = mongoose;

const cartSchema = new Schema({
    userId:{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items:[{
        productId:{  // just a obj id 
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
              
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice:{
            type: Number,
            required: true
        }
    }],
      coupon : {
            code : String,
            discount : Number
        }
})

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;