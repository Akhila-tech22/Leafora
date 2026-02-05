const upload = require('../helper/multer');
const express = require('express')
const router = express.Router();
const userController = require('../controller/userController')
const {adminAuth,userAuth}= require("../middleware/auth")
const shopController = require('../controller/shopController')
const passport = require('../config/passportConfig');
const cartController = require('../controller/cartController')
const checkoutController = require('../controller/checkoutController')
const profileController = require('../controller/profileController')
const orderController = require('../controller/orderController')
const walletController = require('../controller/walletController')

router.get('/',userController.GetHome)
router.get('/login',userController.GetLogin)
router.post('/login',userController.postLogin)
router.get('/register',userController.GetSin)
router.post('/register',userController.postSin)
router.get('/logout',userController.logout)


// Google login start
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google login callback
router.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',
        failureMessage: true  // <-- Enables messages
    }),
    (req, res) => {
        req.session.user = req.user._id;
         req.session.userName = req.user.name;   
        res.redirect('/');
    }
);

//shop
router.get('/shop',shopController.getShop);
//router.get('/shop/ajax',shopController.getShopAjax);
router.get('/productDetails/:id', userAuth,shopController.details);


//cart
router.post('/addTocart',userAuth,cartController.addToCart)
router.get('/cart',userAuth,cartController.getCart)
router.post("/changeQty",userAuth,cartController.changeQty)
router.post('/removeCart',userAuth,cartController.removeCart)


//profile
router.get('/profile',userAuth, profileController.getProfile)
router.post('/upload-profile-image',userAuth, upload.single('profileImage'), profileController.updateProfileImage);
router.post('/removeProfilePicture',userAuth, profileController.removeProfleImage)
router.post('/updateProfile', userAuth,profileController.updateProfile)
router.post('/changeEmail',userAuth,profileController.changeEmail)
router.get('/verify-email-otp',userAuth, profileController.getEmailOtp)
router.post('/verify-otp', userAuth, profileController.verifyOtp)
router.post('/resend-otp', userAuth, profileController.resendOtp)
router.post('/changePassword', userAuth, profileController.changePass)
router.get('/userCoupons', userAuth,profileController.getCoupon)
router.get('/coupons/check-updates',userAuth, profileController.checkUpdates)
router.get('/address',userAuth,checkoutController.getAddressPage)
router.post('/postAdd',userAuth, checkoutController.postAddress)
router.post('/remove-address',userAuth,checkoutController.removeAddress)

//checkout
router.get('/checkout',userAuth,checkoutController.getCheckout)
router.post('/apply-coupon', userAuth, checkoutController.applyCoupon)
router.post('/remove-coupon', userAuth, checkoutController.removeCoupon)


//order
router.get('/order', userAuth,orderController.getOrder)
router.post('/place-order', userAuth, orderController.placeOrder);
router.post('/verify-payment', userAuth, orderController.verifyPayment);
router.post('/payment-failed', userAuth, orderController.paymentFailed);
router.get('/order-success/:id', userAuth, orderController.orderSuccess);
router.get('/order-failure/:id', userAuth, orderController.orderFailure);
router.get('/retry/:id',userAuth,orderController.retry)
router.get('/order-details/:id',userAuth,orderController.orderDetails)
router.post('/request-return/:orderId/:itemId', userAuth, orderController.returnReq)
router.post('/cancel-order-item/:orderId/:itemId', userAuth, orderController.cancelOrder)


//wallet
router.get('/wallet',userAuth,walletController.getWallet )

//wishlist
router.get('/wishlist',userAuth,profileController.getWishlist)
router.post('/wishlist/toggle', userAuth,profileController.postWallet)
router.post('/wishlist/remove',userAuth, profileController.removeWhislist)

//password-forgot
router.get('/forgot-password',userController.forgotPass)
router.post('/check-email-existence',userController.postForgotPass)
router.post('/forgot-email-valid',userController.checkForgotPassOtp)
router.get('/forgot-otp',userController.forgotOtp)
router.post('/otp-forgotPass',userController.verifyOtp)
router.get('/passwordChange', userController.passwordChange)
router.post('/verifyPass', userController.verifyPass)
router.post('/resend-PassOtp',userController.resendPassOtp)

//invoice
router.get('/download-invoice/:id',orderController.downloadInvoice)

//about
router.get('/about',profileController.getAbout)

//contact
router.get('/contact',profileController.getContact)
module.exports = router;