const User = require('../schema/userSchema');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema')
const { generateOtp, sendOtpMail } = require('../utils/otp');
const Coupon = require('../schema/couponSchema')
const Order = require('../schema/orderSchema')
const crypto = require('crypto');
const Cart = require('../schema/cartSchema')
const Razorpay = require('razorpay');
const Address = require('../schema/addressSchema');
const Transaction = require('../schema/transactionSchema')
const { generateInvoice } = require('../utils/invoiceGenerator')
const path = require('path');
const fs = require('fs');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
const getOrder = async (req,res) => {
    try{
        const userId = req.session.user;
        const user = await User.findById(userId);
        const orders = await Order.find({ userId }).sort({ createdOn: -1 }); 
        res.render('user/order', {
            user,
            orders,
        })
    }catch(error) {

    }
}

const orderSuccess = async (req, res) => {
    const userId = req.session.user;
    const orderId = req.params.id;
    const user = await User.findById(userId);
    const order = await Order.findById(orderId);

    res.render('user/orderSuccess', { user, orderId: order._id });
};

const orderFailure = async (req, res) => {
    const userId = req.session.user;
    const orderId = req.params.id;
    const user = await User.findById(userId);
    res.render('user/orderFailure', { user, orderId });
};



const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    const userId = req.session.user;
    const order = await Order.findById(orderId);
    if (!order) return res.json({ success: false });

    const cart = await Cart.findOne({ userId });

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      order.paymentStatus = "failed";
      order.orderedItems.forEach(i => (i.status = "payment_failed"));
      await order.save();
      return res.json({ success: false });
    }

    order.paymentStatus = "completed";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.orderedItems.forEach(i => (i.status = "ordered"));

    
    if (!order.couponApplied && cart?.coupon) {
      const couponDoc = await Coupon.findOne({ name: cart.coupon.code });
      const discount = cart.coupon.discount || 0;

      if (couponDoc) {
        await Coupon.findByIdAndUpdate(couponDoc._id, {
          $addToSet: { userId }
        });

        order.couponApplied = true;
        order.couponDetails = {
          couponId: couponDoc._id,
          couponCode: couponDoc.name,
          discountAmount: discount
        };

        const total = order.orderedItems.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        );

        order.totalPrice = total;
        order.finalAmount = total + 50 - discount;
      }
    }

    await order.save();

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity }
      });
    }

    await Cart.deleteOne({ userId });
    delete req.session.retry;

    res.json({ success: true });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.json({ success: false });
  }
};


const paymentFailed = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user;
    const order = await Order.findById(orderId);
    if (!order) return res.json({ success: false });

    order.paymentStatus = "failed";
    order.orderedItems.forEach(i => i.status = "payment_failed");
    await order.save();
    await Cart.updateOne(
  { userId },
  { $unset: { coupon: 1 } }
);

    res.json({ success: true });

  } catch (err) {
    console.error("PAYMENT FAILED ERROR:", err);
    res.json({ success: false });
  }
};


const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;

        if (!userId) {
            return res.json({ success: false, message: "User not logged in" });
        }

        // RETRY FLOW
        if (req.session.retry) {
            const orderId = req.session.retry.orderId;
            const oldOrder = await Order.findById(orderId);

            if (!oldOrder) {
                return res.json({ success: false, message: "Order not found" });
            }

            for (const item of oldOrder.orderedItems) {
                const product = await Product.findById(item.product);
                if (!product || product.quantity < item.quantity) {
                    return res.json({
                        success: false,
                        message: `${product?.name || "Product"} out of stock`
                    });
                }
            }

            const deliveryCharge = 50;
            const freshTotal = oldOrder.orderedItems.reduce(
                (sum, i) => sum + i.price * i.quantity,
                0
            );

            oldOrder.totalPrice = freshTotal;
            oldOrder.discount = 0;
            oldOrder.couponApplied = false;
            oldOrder.couponDetails = null;
            oldOrder.paymentMethod = paymentMethod;
            oldOrder.paymentStatus = "pending";
            oldOrder.finalAmount = freshTotal + deliveryCharge;

            await oldOrder.save();

            if (paymentMethod === "cod") {
                oldOrder.paymentStatus = "pending";
                oldOrder.orderedItems.forEach(i => (i.status = "ordered"));
                await oldOrder.save();

                for (const item of oldOrder.orderedItems) {
                    await Product.findByIdAndUpdate(item.product, {
                        $inc: { quantity: -item.quantity }
                    });
                }

                await Cart.deleteOne({ userId });
                delete req.session.retry;

                return res.json({ success: true, orderId: oldOrder._id });
            }

            if (paymentMethod === "online") {
                const razorpayOrder = await razorpay.orders.create({
                    amount: oldOrder.finalAmount * 100,
                    currency: "INR",
                    receipt: oldOrder._id.toString()
                });

                oldOrder.razorpayOrderId = razorpayOrder.id;
                await oldOrder.save();

                return res.json({
                    success: true,
                    razorpayOrder,
                    orderId: oldOrder._id,
                    key: process.env.RAZORPAY_KEY_ID
                });
            }

            if (paymentMethod === 'wallet') {
                const user = await User.findById(userId);

                if (user.wallet < oldOrder.finalAmount) {
                    return res.json({ success: false, message: "Insufficient wallet balance" });
                }

                oldOrder.paymentStatus = "completed";
                oldOrder.orderedItems.forEach(i => i.status = "ordered");
                await oldOrder.save();

                for (const item of oldOrder.orderedItems) {
                    await Product.findByIdAndUpdate(item.product, {
                        $inc: { quantity: -item.quantity }
                    });
                }

                await Cart.deleteOne({ userId });
                delete req.session.retry;

                user.wallet -= oldOrder.finalAmount;
                await user.save();

                const productDescriptions = oldOrder.orderedItems
                    .map(i => `${i.productName} (qty: ${i.quantity})`)
                    .join(", ");
                await Transaction.create({
                    userId,
                    amount: oldOrder.finalAmount,
                    transactionType: "debit",
                    paymentMethod: "wallet",
                    purpose: "purchase",
                    status: "completed",
                    description: `Purchase Orders: ${productDescriptions}`,
                    orders: [{
                        orderId: oldOrder.orderId,
                        amount: oldOrder.finalAmount
                    }],
                    walletBalanceAfter: user.wallet
                });

                return res.json({ success: true, orderId: oldOrder._id });
            }
        }

        // NORMAL FLOW
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.json({ success: false, message: "Cart empty" });
        }

       
        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.json({ success: false, message: "No address found" });
        }

        const selectedAddress = userAddresses.address.find(
            addr => addr._id.toString() === addressId
        );

        if (!selectedAddress) {
            return res.json({ success: false, message: "Invalid address" });
        }

        const orderedItems = cart.items.map(item => ({
            product: item.productId._id,
            productName: item.productId.productName,
            productImage: item.productId.productImage[0],
            quantity: item.quantity,
            price: item.price,
            regularPrice: item.productId.regularPrice,
            status: "ordered"
        }));

        const totalPrice = orderedItems.reduce(
            (sum, i) => sum + i.price * i.quantity,
            0
        );

        const deliveryCharge = 50;
        const discount = cart.coupon?.discount || 0;
        const finalAmount = totalPrice + deliveryCharge - discount;

        if (finalAmount < 0) {
            return res.json({ success: false, message: "Invalid amount" });
        }

    
        const newOrder = new Order({
            userId,
            address: {
                addressType: selectedAddress.addressType,
                name: selectedAddress.name,
                country: selectedAddress.country,
                city: selectedAddress.city,
                streetAddress: selectedAddress.streetAddress,
                landMark: selectedAddress.landMark,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                phone: selectedAddress.phone,
                altPhone: selectedAddress.altPhone || null
            },
            orderedItems,
            totalPrice,
            discount,
            deliveryCharge,
            finalAmount,
            paymentMethod,
            paymentStatus: "pending"
        });

        await newOrder.save();

        if (paymentMethod === "cod") {
            console.log('normal flow cod')
            newOrder.paymentStatus = "pending";
            await newOrder.save();

            if (cart.coupon) {
                const couponDoc = await Coupon.findOne({ name: cart.coupon.code });
                if (couponDoc) {
                    await Coupon.findByIdAndUpdate(couponDoc._id, {
                        $addToSet: { userId }
                    });

                    newOrder.couponApplied = true;
                    newOrder.couponDetails = {
                        couponId: couponDoc._id,
                        couponCode: couponDoc.name,
                        discountAmount: discount
                    };
                }
            }

            await newOrder.save();

            for (const item of newOrder.orderedItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity }
                });
            }

            await Cart.deleteOne({ userId });
            return res.json({ success: true, orderId: newOrder._id });
        }

        if (paymentMethod === 'wallet') {
            newOrder.paymentStatus = "completed";
            const user = await User.findById(userId);

            if (user.wallet < finalAmount) {
                return res.json({ success: false, message: "Insufficient wallet balance" });
            }
            user.wallet -= newOrder.finalAmount;
            await user.save();
            await newOrder.save();

            if (cart.coupon) {
                const couponDoc = await Coupon.findOne({ name: cart.coupon.code });
                if (couponDoc) {
                    await Coupon.findByIdAndUpdate(couponDoc._id, {
                        $addToSet: { userId }
                    });

                    newOrder.couponApplied = true;
                    newOrder.couponDetails = {
                        couponId: couponDoc._id,
                        couponCode: couponDoc.name,
                        discountAmount: discount
                    };
                }
            }

            await newOrder.save();

            for (const item of newOrder.orderedItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity }
                });
            }

            await Cart.deleteOne({ userId });

            const productDescriptions = newOrder.orderedItems
                .map(i => `${i.productName} (qty: ${i.quantity})`)
                .join(", ");

            const transaction = new Transaction({
                userId,
                amount: newOrder.finalAmount,
                transactionType: 'debit',
                paymentMethod: newOrder.paymentMethod,
                status: 'completed',
                purpose: 'purchase',
                description: `Purchase Orders: ${productDescriptions}`,
                orders: [{
                    orderId: newOrder.orderId,
                    amount: newOrder.finalAmount
                }],
                walletBalanceAfter: user.wallet
            });

            await transaction.save();
            return res.json({ success: true, orderId: newOrder._id });
        }

        if (paymentMethod === "online") {
            const razorpayOrder = await razorpay.orders.create({
                amount: finalAmount * 100,
                currency: "INR",
                receipt: newOrder._id.toString()
            });

            newOrder.razorpayOrderId = razorpayOrder.id;
            await newOrder.save();

            return res.json({
                success: true,
                razorpayOrder,
                orderId: newOrder._id,
                key: process.env.RAZORPAY_KEY_ID
            });
        }

    } catch (err) {
        console.error("PLACE ORDER ERROR:", err);
        res.json({ success: false, message: "Server error" });
    }
};


const retry = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.id;

    if (!userId || !orderId) {
      return res.redirect("/login");
    }

    const order = await Order.findOne({
      userId,
      _id: orderId,
      paymentStatus: "failed"
    });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    
    req.session.retry = { orderId };

    res.redirect("/checkout");
  } catch (error) {
    console.error("RETRY ERROR:", error);
    res.redirect("/orders");
  }
};


const orderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const id = req.params.id;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const order = await Order.findById(id).lean();
        if (!order) {
            return res.status(404).send('Order not found');
        }

     
        let addressData;
        
        if (typeof order.address === 'object' && order.address.name) {
    
            addressData = {
                name: order.address.name,
                address: order.address.streetAddress,
                state: order.address.state,
                city: order.address.city,
                pincode: order.address.pincode,
                phone: order.address.phone,
                landMark: order.address.landMark,
                country: order.address.country
            };
        } else {
         
            try {
                const getAddress = await Address.findOne({ userId });
                if (getAddress) {
                    const address = getAddress.address.id(order.address);
                    if (address) {
                        addressData = {
                            name: address.name,
                            address: address.streetAddress,
                            state: address.state,
                            city: address.city,
                            pincode: address.pincode,
                            phone: address.phone,
                            landMark: address.landMark,
                            country: address.country
                        };
                    }
                }
            } catch (err) {
                console.error('Error fetching old address format:', err);
                addressData = {
                    name: 'N/A',
                    address: 'Address not available',
                    state: 'N/A',
                    city: 'N/A',
                    pincode: 'N/A',
                    phone: 'N/A'
                };
            }
        }

      
        order.address = addressData;

        res.render('user/orderDetails', {
            user: user.name,
            order
        });

    } catch (error) {
        console.error('Order details error:', error);
        res.status(500).send('Error loading order details');
    }
};


const returnReq = async (req,res) => {
  try{
    const userId = req.session.user;
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;

    const user = await User.findById(userId)
    if(!user) {
      return res.redirect('/login')
    }
    const order = await Order.findById(orderId)
    if(!order) {
      return res.json({success : false, message : "Order is not found!"})
    }
    const item = order.orderedItems.find(i => i._id.toString() === itemId)
    if(!item) {
      return res.json({success : false, message : "Item is not found!"})
    }
   item.status = 'return_requested';
    await order.save();

    res.json({success : true , message : "Update successfully"})

  }catch(error) {

  }
}

const cancelOrder = async (req,res) => {
  try{
    const userId = req.session.user;
    const user = await User.findById(userId)
    if(!user) {
      return res.redirect('/login')
    }
    const orderId = req.params.orderId;
    const itemId = req.params.itemId;
    if(!orderId || !itemId) {
      return res.json({success : false, message : "something is missing!"})
    }
    const order = await Order.findById(orderId).populate('orderedItems.product')
    if(!order) {
      return res.json({success : false, message  :"Order is not found!"})
    }
    const item = order.orderedItems.find(i => i._id.toString() === itemId)
    if(!item) {
      return res.json({success : false, message  :"Item is not found!"})
    }
    await Product.findByIdAndUpdate(item._id , {
      $inc : {quantity : item.quantity}
    })
    
    if(order.paymentMethod === 'online' || order.paymentMethod === 'wallet') {
        let refundAmt = order.finalAmount;

        item.status = 'cancelled';
        let user = await User.findById(order.userId)
        user.wallet += refundAmt;
        await user.save();

        const transaction = new Transaction({
                userId: order.userId,
                amount: refundAmt,
                transactionType: 'credit',
                paymentMethod: order.paymentMethod,
                status: 'completed',
                purpose: 'cancellation',
                description: `Cancel Item for ${item.productName}, qty ${item.quantity}`,
                orders: [{
                  orderId: order.orderId,
                  amount: refundAmt
                }],
                walletBalanceAfter: user.wallet
              });
        

                await transaction.save();
                await order.save();
        return res.json({
        success: true,
        message: "Cancel Item successfully"
      });
    }

    if(order.paymentMethod = 'cod') {
         item.status = 'cancelled';
          await order.save();

           return res.json({
        success: true,
        message: "Cancel Item successfully"
      });

    }
   

  }catch(error) {

  }
}

const downloadInvoice = async (req, res) => {
    try {
        const userId = req.session.user?._id || req.session.user;
        const { id } = req.params;

        if (!userId) {
            return res.redirect('/login');
        }

        const order = await Order.findOne({ _id: id, userId })
            .populate('orderedItems.product')
            .lean();

        if (!order) {
            return res.status(404).send('Order not found');
        }

 
        console.log('Order Address:', JSON.stringify(order.address, null, 2));

        const user = await User.findById(userId).lean();
        
        if (!user) {
            return res.status(404).send('User not found');
        }

        const invoicesDir = path.join(__dirname, '../invoices');
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true });
        }

        const invoiceFilename = `invoice-${order.orderId}.pdf`;
        const invoicePath = path.join(invoicesDir, invoiceFilename);

        if (fs.existsSync(invoicePath)) {
            fs.unlinkSync(invoicePath);
        }

        await generateInvoice(order, user, invoicePath);

        res.download(invoicePath, invoiceFilename, (err) => {
            if (err) {
                console.error('Download error:', err);
                return res.status(500).send('Error downloading invoice');
            }
        });

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).send('Invoice generation failed');
    }
};




module.exports = {
    getOrder,
    orderSuccess,
    orderFailure,
    verifyPayment,
    paymentFailed,
    placeOrder,
    retry,
    orderDetails,
    returnReq,
    cancelOrder,
    downloadInvoice,
}