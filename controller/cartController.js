const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const { error } = require('console');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema');
const Cart = require('../schema/cartSchema')

const addToCart = async (req, res) => {
    try {
        const { productId } = req.body;
        
        console.log('🔹 Add to cart request for product:', productId); 
        
        if (!productId) {
            return res.json({ success: false, message: "Product ID missing" });
        }

        let product = await Product.findById(productId);
        if (!product) {
            return res.json({ success: false, message: "Product doesn't exist!" });
        }

        if(product.isBlocked) {
            return res.json({success: false, message: "Product is Blocked, try later"})
        }

        let userId = req.session.user?._id || req.session.user;
        if (!userId) {
            return res.json({ success: false, redirect: '/login'});
        }

        let cart = await Cart.findOne({ userId });

        if (cart) {
            let cartIndex = cart.items.findIndex(p => p.productId.toString() === productId);
            
            if (cartIndex > -1) {
                console.log(' Current quantity:', cart.items[cartIndex].quantity); 
                
              
                if(cart.items[cartIndex].quantity >= 5) {
                    
                    return res.json({ 
                        success: false, 
                        message: "Maximum quantity (5) for this product reached!" 
                    });
                }
                if(cart.items[cartIndex].quantity >= product.quantity) {
                    return res.json({success : false, message : 'Product Stock exceed!'})
                }
                
                cart.items[cartIndex].quantity += 1;
                cart.items[cartIndex].totalPrice =
                    cart.items[cartIndex].quantity * cart.items[cartIndex].price;
                    
                console.log('Updated quantity:', cart.items[cartIndex].quantity); 
            } else {
                cart.items.push({
                    productId,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice
                });
            }

            await cart.save();
            return res.json({ success: true, message: "Cart updated!" });
        } else {
            let newCart = new Cart({
                userId,
                items: [{
                    productId,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice
                }]
            });
            await newCart.save();
            return res.json({ success: true, message: "Cart created!" });
        }
    } catch (error) {
        console.error("Add to cart error:", error);
        res.status(500).json({ success: false, message: "Server error!" });
    }
};

const getCart = async (req, res) => {
    try {
        const user = req.session.userName;
        const userId = req.session.user;
        if (!user) {
            return res.redirect('/login'); 
        }

        
        let cart = await Cart.findOne({ userId })
            .populate('items.productId'); 

        if(cart) {
            cart.items = cart.items.filter(item => item.productId && !item.productId.isBlocked)
            await cart.save();
        }

  let total = 0;
let cartCount = 0;
let delivery = 50;
let subtotal = 0;

if (cart && cart.items.length > 0) {
    subtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
    cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    total = subtotal + delivery;
}

res.render("user/cart", {
    cart,
    user,
    total,
    delivery,
    subtotal,
    cartCount
});


    } catch (error) {
        console.error("Get cart error:", error);
        res.status(500).send("Server error");
    }
};


const changeQty = async (req, res) => {
    try {
        const { productId, action } = req.body;
        if (!productId || !action) {
            return res.json({ success: false, message: "Something missing!" });
        }

        
        const userId = req.session.user;
        if (!userId) {
            return res.json({ success: false, message: "User not logged in" });
        }

        let cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart) {
            return res.json({ success: false, message: "Cart doesn't exist" });
        }

  
        let cartIndex = cart.items.findIndex(
            p => p.productId._id.toString() === productId
        );
        if (cartIndex === -1) {
            return res.json({ success: false, message: "Product not found in cart" });
        }

        const item = cart.items[cartIndex];

       
        if (action === "minus") item.quantity -= 1;
        else if (action === "add") item.quantity += 1;

   

        if (item.quantity <= 0 || item.productId.isBlocked) {
            cart.items.splice(cartIndex, 1);
        } else {
           
            if (item.quantity > 5) {
                return res.json({ success: false, message: "Only select up to 5 products" });
            }
            if (item.quantity > item.productId.quantity) {
                return res.json({ success: false, message: "Stock limit exceeded" });
            }

      
            item.totalPrice = item.quantity * item.price;
        }

        await cart.save();
        let subtotal =  cart.items.reduce((acc, current) => acc + current.totalPrice , 0)

  

let delivery = 50;
let total = subtotal + delivery;


let cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

return res.json({
    success: true,
    newQuantity: cart.items[cartIndex]?.quantity || 0,
    subtotal,
    delivery,
    total,
    cartCount
});


    } catch (error) {
        console.error("ChangeQty error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const removeCart = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.json({ success: false, message: "Something missing!" });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.json({ success: false, message: "User not logged in!" });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({ success: false, message: "Cart not found!" });
        }

     
        let cartIndex = cart.items.findIndex(p => p.productId.toString() === productId);
        if (cartIndex === -1) {
            return res.json({ success: false, message: "Product not in cart!" });
        }

      
        cart.items.splice(cartIndex, 1);

       
        await cart.save();

   
        const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

        return res.json({ success: true, message: "Item removed successfully", cartCount });
    } catch (error) {
        console.error("RemoveCart error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


module.exports = {
     addToCart,
    getCart,
    changeQty,
   removeCart,
}