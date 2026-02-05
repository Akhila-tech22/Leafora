const mongoose = require('mongoose')
const User = require('../schema/userSchema')
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema');
const { render } = require('ejs');
const Coupon = require('../schema/couponSchema');
const Transaction = require('../schema/transactionSchema');
const { generateOtp, sendOtpMail } = require('../utils/otp');



const GetHome = async (req, res) => {
    try {
      
        let products = await Product
            .find({ isBlocked: false, quantity: { $gte: 0 } })
            .populate('category') 
            .sort({ createdOn: -1 })
            .limit(5);

   
        const featuredBooks = products.map(product => {
            const productObj = product.toObject();
            
        
            const categoryOffer = product.category?.offer || 0;
            const productOffer = product.productOffer || 0;
            const effectiveOffer = Math.max(productOffer, categoryOffer);
            
          
            const effectivePrice = product.regularPrice * (1 - effectiveOffer / 100);
            const salePrice = Math.round(effectivePrice * 100) / 100;
            
       
            return {
                ...productObj,
                effectiveOffer,
                salePrice
            };
        });

        res.render("user/home", {
            user: req.session.userName || null,
            featuredBooks
        });
    } catch(error) {
        console.error(error);
        res.redirect("/login");
    }
};

const GetLogin = async (req,res) => {
try {
    res.render("user/userLogin");
}catch(error) {
     console.log(error);
   res.status(500).json({ message: "Server error" });
}
}
const GetSin = async (req,res) => {
try {
    res.render("user/register");
}catch(error) {
     console.log(error);
   res.status(500).json({ message: "Server error" });
}
}
const postSin = async (req, res) => {
  try {
    const { name, email, phone, password, code } = req.body;
    let errors = {};

    if (!name) errors.name = "Name is required";
    if (!email) errors.email = "Email is required";
    if (!phone) errors.phone = "Phone number is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      return res.json({ success: false, errors });
    }

    const exist = await User.findOne({ email });
    if (exist) {
      return res.json({
        success: false,
        errors: { email: "Email already exists" }
      });
    }

  
    let userCode = null;
    if (code) {
      userCode = await User.findOne({ referalCode: code });
      if (!userCode) {
        return res.json({
          success: false,
          errors: { code: "Invalid referral code" }
        });
      }
    }

    const hashPass = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashPass
    });

    const referalCode =
      "BOOK" + newUser._id.toString().slice(-6).toUpperCase();
    newUser.referalCode = referalCode;

    await newUser.save();

    if (userCode) {
      userCode.wallet += 100;
      await userCode.save();

      const transaction = new Transaction({
        userId: userCode._id,
        amount: 100,
        transactionType: "credit",
        paymentMethod : 'wallet',
        
        purpose: "wallet_add",
        description: `${name} used your referral code`,
        walletBalanceAfter: userCode.wallet,
        createdAt : Date.now()
      });

      await transaction.save();
    }

           
        req.session.user = newUser._id;
        req.session.userName = newUser.name;

    return res.json({
      success: true,
      message: "User registered successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


const postLogin = async (req,res) => {
    try {
        const {email, password} = req.body;
        if(!email || !password) return res.json({success:false, message:"All fields required"});

        const user = await User.findOne({email});
        if(!user) return res.json({success:false, message:"Email does not exist"});
        if(user.isBlocked) return res.json({success:false, message:"You are blocked"});

        const match = await bcrypt.compare(password, user.password);
        if(!match) return res.json({success:false, message:"Invalid password"});

     
        req.session.user = user._id;
        req.session.userName = user.name;

        
        res.json({success:true, message:"Login successful"});

    } catch(error) {
        console.error(error);
        res.status(500).json({success:false, message:"Server error"});
    }
}


const logout = async(req,res) => {
    try {
        req.session.destroy((error)=> {
            if(error) {
                console.log("error is session destroy");
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    }catch(error) {
         console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const forgotPass = async (req,res) => {
    try{
      req.session.role = 'user';
        res.render('user/forgotPass');
    }catch(error) {
         console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const postForgotPass = async (req,res) => {
      try {
    const { email } = req.body;
    const user = await User.findOne({ email: email });
    res.json({ exists: !!user });
   

  } catch (error) {
    console.error('Error checking email existence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}



const checkForgotPassOtp = async (req,res) => {
    try{
        
         const {email} = req.body;
    const otp = generateOtp()

    req.session.email = email;
        req.session.forgotOtp = otp;
        req.session.forgotOtpExpiry = Date.now() + 300000;


      console.log("EMAIL OTP:", otp);

    const emailSend = await sendOtpMail(email, otp)
    if(!emailSend) {
        return res.redirect('/forgot-password');
    }
    res.redirect('/forgot-otp')

    }catch(error) {
  console.error("Forgot OTP error:", error);
  res.redirect('/forgot-password');
}

}

const forgotOtp = async (req,res) => {
    try{

        res.render('user/forgotPass-otp',{
            email  : req.session.email
        })
    }catch(error) {
         console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}


const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    const sessionOtp = req.session.forgotOtp;
    const expireData = req.session.forgotOtpExpiry;

    console.log("Entered OTP:", otp);
    console.log("Session OTP:", sessionOtp);

    if (!sessionOtp || !expireData) {
      return res.json({ success: false, message: "Session expired!" });
    }

    if (Date.now() > expireData) {
      req.session.forgotOtp = null;
      req.session.forgotOtpExpiry = null;
      return res.json({ success: false, message: "OTP expired!" });
    }

    if (otp !== sessionOtp) {
      return res.json({ success: false, message: "OTP mismatch!" });
    }

  
    req.session.forgotOtp = null;
    req.session.forgotOtpExpiry = null;

    return res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
  }
};

const passwordChange = async (req,res) => {
    try{

        res.render('user/confirmPass')
    }catch(error) {
         console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const verifyPass = async (req,res) => {
    try{

        const { newPass, confirmPass } = req.body;
        if(!newPass || !confirmPass) {
            return res.json({success : false, message : "Something Missing!"})
        }
        const hashPass = await bcrypt.hash(newPass , 10);
        const email = req.session.email;
        if (!email) {
      return res.json({ success: false, message: "Session expired. Please try again." });
    }

        const user = await User.findOne({email});
        if(!user) {
            return res.json({success : false, message : "User is not found!"})
        }
        user.password = hashPass;
        await user.save();

        req.session.email = null;
        
        const role = req.session.role;
      
        if(role === 'admin') {
          redirectUrl = 'admin/login'
        } else if(role === 'user') {
          redirectUrl = '/login'
        }
        delete req.session.role;

        res.json({success : true, message  :"Password updated successfully", redirectUrl})

    }catch(error) {
          console.error("Error in verifyPass:", error);
    res.json({ success: false, message: "Server error. Try again later." });

    }
}

const resendPassOtp = async (req,res) => {
    try{
        const otp = generateOtp();
        const email = req.session.email;
        if(!email) {
            return res.json({success : false, message  :"Email not Found!"})
        }

           req.session.email = email;
        req.session.forgotOtp = otp;
        req.session.forgotOtpExpiry = Date.now() + 300000;


      console.log("EMAIL OTP:", otp);

        const sendEmail = sendOtpMail(email, otp);
        if(!sendEmail) {
             return res.redirect('/forgot-password');
        }
        res.redirect('/forgot-otp')

    }catch(error) {
         console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

module.exports = {GetHome,
    GetLogin,
    GetSin,
    postSin,
    postLogin,
    logout,
    forgotPass,
    postForgotPass,
    checkForgotPassOtp,
    forgotOtp,
    verifyOtp,
    passwordChange,
    verifyPass,
    resendPassOtp
}