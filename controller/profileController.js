
const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const { error } = require('console');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema')
const { generateOtp, sendOtpMail } = require('../utils/otp');
const Coupon = require('../schema/couponSchema');
const Wishlist = require('../schema/wishlistSchema');
const getProfile = async (req, res) => {
    try {
      
        const userId = req.session.user;

        if (!userId) {
            return res.redirect('/login');
        }
        const user = await User.findById(userId);

        
        
        res.render('user/profile', {
            user,
            
        });

    } catch (error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
};

const updateProfileImage = async (req,res) => {
    try{
          const userId = req.session.user;
          const uploadImage = req.file.filename;

          const updateUser = await User.findByIdAndUpdate(userId, {profilePicture : uploadImage}, {new : true});
     
          res.redirect('/profile')
          

    }catch(error) {
        console.error('Image upload error:', error);
    res.status(500).send('Failed to upload profile image.');

    }
}
const removeProfleImage = async (req, res) => {
    try {
        const userId = req.session.user;
        await User.findByIdAndUpdate(userId, { profilePicture: null });
        res.json({ success: true });
    } catch (error) {
        console.error('Image delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete profile image.' });
    }
};

const updateProfile = async (req,res) => {
    try{
        const userId = req.session.user;
        const {name , userName, phone} = req.body;
        await User.findByIdAndUpdate(userId, {name : name, username : userName, phone : phone})
         res.json({ success: true });
    }catch(error) {
             console.error('profile formdata error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload profile data.' });
    }
}

const changeEmail = async (req,res) => {
    try{
        const {newEmail} = req.body;
        if(!newEmail) {
            return res.json({success : false, message : "Something Missing!!"})
        }
        const userId = req.session.user;
        const user = await User.findById(userId)
        if(newEmail === user.email) {
            return res.json({success : false, message : "Please enter new Email!"})
        }

        const otp = generateOtp();
        req.session.newEmail = newEmail;
        req.session.emailOtp = otp;
        req.session.otpExpiry = Date.now() + 5 * 60 * 1000; // 5 min
        

        await sendOtpMail(newEmail, otp);

         console.log("EMAIL OTP:", otp);

        res.json({
            success : true,
            
        })
    }catch(error) {
         console.error('OTP send error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
}
const getEmailOtp =  async (req,res) => {
    try{
        let userId = req.session.user;
        const user = await User.findById(userId);
        const newEmail = req.session.newEmail;
        res.render('user/emailOtp', {
            user,
            newEmail
            
        })
    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const verifyOtp = async (req,res) => {
    try{
        const {otp} = req.body;
        if(!otp) {
            return res.json({success : false, message : "Something Missing!"})
        }

        const sessionOtp = req.session.emailOtp;
        const newEmail = req.session.newEmail;
        const expireData = req.session.otpExpiry;

        if(!sessionOtp || !newEmail || !expireData) {
            return res.json({success : false, message : "Session expried!"})
        }

        if(Date.now() > expireData) {
                req.session.emailOtp = null;
                req.session.newEmail = null;
                req.session.expireData = null;
                return res.json({success : false, message : "Otp expried!, Please try again"})
        }

        if(otp !== sessionOtp) {
            return res.json({success : false, message : "Otp is Mismatch! , Please try again"})
        } 

        const userId = req.session.user;
        
        await User.findByIdAndUpdate(userId, {email : newEmail});
        res.json({success : true, message : "Email changed successfully"})


    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const changePass = async (req,res) => {
    try{
        const {currentPass, newPass, confirmPass} = req.body;
        if(!currentPass || !newPass || !confirmPass) {
            return res.json({success : false, message : "Something Missing!"})
        }
        const userId = req.session.user;
        const user = await User.findById(userId);
        const isMatch = await bcrypt.compare(currentPass, user.password)
        if(!isMatch) {
            return res.json({success : false, message : "Incorrect Password!"})
        }
        const hashPass = await bcrypt.hash(newPass, 10);
        await User.findByIdAndUpdate(userId, {password : hashPass})
        res.json({success : true, message : "Password Change Successfully"})


    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}
const resendOtp = async (req,res) => {
    try{
        const newEmail = req.session.newEmail;
         const otpExpiry = req.session.otpExpiry = Date.now() + 5 * 60 * 1000; 
         const otp = generateOtp();
         req.session.emailOtp = otp;

         await sendOtpMail(newEmail, otp);
          console.log("EMAIL OTP:", otp);

        res.json({
            success : true,
            redirectUrl : '/verify-email-otp'
        })
        

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const getCoupon = async(req,res) => {
    try{
        const userId = req.session.user;
        const user = await User.findById(userId);
        if(!user) {
            return res.redirect('/login')
        }

        const coupons = await Coupon.find();
        res.render('user/coupon', {
            user,
            coupons
        })

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    } 
}

const checkUpdates = async (req,res) => {
    try{
        const userId = req.session.user;
        const user = await User.findById(userId);
        const coupons = await Coupon.find({isList : true, expireOn : {$gte : Date.now()}})
        res.json({success : true, count : coupons.length})

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user;

    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    const wishlist = await Wishlist.findOne({ userId }).populate('products.productId').sort({createdOn : -1})
   
    if(wishlist && wishlist.products) {
        wishlist.products.sort((a,b) => b.addedOn  - a.addedOn )  
    }

    return res.render('user/wishlist', {
      user,
      wishlist,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error');
  }
};


const postWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if (!productId) {
      return res.json({ success: false, message: "Product ID missing" });
    }

    let wishlist = await Wishlist.findOne({ userId });


    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        products: []
      });
    }

   
    const alreadyExists = wishlist.products.some(
      p => p.productId.toString() === productId
    );

    if (alreadyExists) {
      return res.json({
        success: false,
        message: "Product already in wishlist"
      });
    }

    // add product
    wishlist.products.push({ productId });

    await wishlist.save();

    return res.json({
      success: true,
      message: "Added to wishlist"
    });

  } catch (error) {
    console.error("WISHLIST ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const removeWhislist = async (req,res) => {
    try{
        const {productId} = req.body;
        if(!productId) {
            return res.json({success : false , message : "Something Missing!"})
        }

        const userId = req.session.user;
        const wishlist = await Wishlist.findOne({userId});
        if(!wishlist) {
            return res.json({success : false , message : "Wishlist is missing!"})
        }
        const exising = wishlist.products.some(item => item.productId.toString() === productId)
        if(!exising) {
            return res.json({success : false , message : "Product is Missing!"})
        }
        wishlist.products.pull({productId});
        await wishlist.save();
         return res.json({ success: true, message: "Item removed successfully" });
    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const getAbout = async (req,res) => {
     res.render("user/about", {
        user: req.session.userName || null
    });
}

const getContact = async (req,res) => {
     res.render("user/contact", {
        user: req.session.userName || null
    });
}

module.exports = {
    getProfile,
    updateProfileImage,
    removeProfleImage,
    updateProfile,
    changeEmail,
    getEmailOtp,
    verifyOtp,
    changePass,
    resendOtp,
    getCoupon,
    checkUpdates,
    getWishlist,
    postWallet,
    removeWhislist,
    getAbout,
    getContact,
}