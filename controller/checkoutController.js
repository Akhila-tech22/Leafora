
const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const { error } = require('console');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema')
const Cart = require('../schema/cartSchema')
const Address = require('../schema/addressSchema');
const Coupon = require('../schema/couponSchema');
const Order = require('../schema/orderSchema')



const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
   
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    

    if (req.session.retry) {
      const orderId = req.session.retry.orderId;
      const order = await Order.findById(orderId).populate('orderedItems.product')

      if (!order) {
        delete req.session.retry;
        return res.redirect("/orders");
      }

    
      const cart = {
        items: order.orderedItems.map(i => ({
          productId: {
            _id: i.product,
            productName: i.productName,
            productImage: i.product.productImage
          },
          quantity: i.quantity,
          price: i.price,
          totalPrice: i.price * i.quantity
        })),
        coupon: order.couponApplied
          ? { discount: order.couponDetails.discountAmount }
          : null
      };

      delete req.session.retry;

      const userAddress = await Address.findOne({ userId });
      const addresses = userAddress ? userAddress.address : [];

      const subtotal = order.totalPrice;
      const delivery = 50;
      const discount = order.couponDetails?.discountAmount || 0;
      const total = subtotal + delivery - discount;

      return res.render("user/checkout", {
        cart,
        addresses,
        user: user.name,
        subtotal,
        delivery,
        total,
        discount,
      });
    }

   
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }

    cart.items = cart.items.filter(i => !i.productId.isBlocked);

    const userAddress = await Address.findOne({ userId });
    const addresses = userAddress ? userAddress.address : [];

    const subtotal = cart.items.reduce(
      (sum, i) => sum + i.totalPrice,
      0
    );

    const delivery = 50;
    const discount = cart.coupon?.discount || 0;
    const total = subtotal + delivery - discount;

    res.render("user/checkout", {
      cart,
      addresses,
      user: user.name,
      subtotal,
      delivery,
      total,
      discount
    });

  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    res.redirect("/500");
  }
};


const getAddressPage = async (req,res) => {
    try{
        let userId = req.session.user;
        const user = await User.findById(userId)
        if(!user) {
            return res.json({success : false, message : "Session error"})
        }
        res.render("user/address",{
            user,
        })

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
} 

const postAddress = async (req, res) => {
    try {
        const {
            name,
            phone,
            streetAddress,
            landMark,
            city,
            pincode,
            state,
            country,
            addressType
        } = req.body;

        if (!name || !phone || !streetAddress || !city || !pincode || !state || !country || !addressType || !landMark) {
            return res.json({ success: false, message: "Something missing!!" });
        }

        const userId = req.session.user?._id || req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Session error!!" });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.json({ success: false, message: "User not found" });
        }

        let userAddress = await Address.findOne({ userId: userData._id });

      
        if (!userAddress) {
            userAddress = new Address({
                userId: userData._id,
                address: []
            });
        }

       
        const isDup = userAddress.address.some(add =>
            add.name.toLowerCase() === name.toLowerCase() &&
            add.phone.toString().trim() === phone.toString().trim() &&
            add.streetAddress.toLowerCase() === streetAddress.toLowerCase() &&
            add.city.toLowerCase() === city.toLowerCase() &&
            add.pincode.toString().trim() === pincode.toString().trim()
        );

        if (isDup) {
            return res.json({success: false, message: "This address already exists" });
        }

    
        userAddress.address.push({
            name,
            phone,
            streetAddress,
            landMark,
            city,
            pincode,
            state,
            country,
            addressType
        });

        await userAddress.save();

        return res.json({ success: true, message: "Successfully added address" });
         // res.render('checkout', { addresses });

    } catch (error) {
        console.error("POST ADDRESS ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const applyCoupon = async (req,res) => {
    try{

        const {input} = req.body;
        const userId = req.session.user;
        const user = await User.findById(userId);
        const coupon = await Coupon.findOne({name : input, expireOn : {$gte : Date.now()}});

        if(!coupon) {
            return res.json({success : false, message : "Coupon is Missing!!"})
        }
        const isDup =  coupon.userId.includes(userId);
        if(isDup) { 
            return res.json({success : false, message : "This Coupon is already used"})
        }
      

        const cart = await Cart.findOne({userId})
        if(!cart) {
            return res.json({success : false, message : "Cart is not found!"})
        }

        const subtotal = cart.items.reduce((sum , i) => sum + i.totalPrice , 0);

          if(subtotal < coupon.minimumPrice) {
            return res.json({success : false, message : "Not eligible for apply coupon for this Amount"})
            return;
          }

        cart.coupon = {
            code : coupon.name,
            discount : coupon.offerPrice
        }
        await cart.save();
        
      
        const delivery = 50;
        const total = subtotal + delivery - coupon.offerPrice

         return res.json({
      success: true,
      discount: coupon.offerPrice,
      newTotal: total
    });

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
         if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not logged in"
      });
    }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({ success: false, message: "Cart not found" });
        }

            cart.coupon = null;
            await cart.save();

        const subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
        const delivery = 50;
        const total = subtotal + delivery;

        return res.json({
            success: true,
            newTotal: total
        });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Server error" });
    }
};


const removeAddress = async (req,res) => {
    try{

        const {addressId} =req.body;
        if(!addressId) {
            return res.json({success : false, message : 'Something Wrong!'})
        }
        const userId = req.session.user;
        if(!userId) {
            return res.redirect('/login')
        }

        const findAdd = await Address.findOne({userId});
        if(!findAdd) {
            return res.json({success : false, message : 'Address not found!'})
        }
        const exist = findAdd.address.find(item => item._id.toString() === addressId);
        if(!exist) {
             return res.json({success : false, message : 'Something Error!'})
        }

        findAdd.address.pull(exist);
        await findAdd.save();
        return res.json({success : true, message : 'Remove address successfully'})
        
    }catch(error) {
            console.log(error)
    res.status(500).json({success:false,message:"Server error"})
    }
}





module.exports = {
    getCheckout,
    getAddressPage,
    postAddress,
    applyCoupon,
    removeCoupon,
    removeAddress,
    
}