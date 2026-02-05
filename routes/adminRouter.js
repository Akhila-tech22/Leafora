const express = require('express');
const router = express.Router();
const adminController = require('../controller/adminController')
const {adminAuth,userAuth}= require("../middleware/auth")
const customerController = require('../controller/customerController')
const categoryController = require('../controller/categoryController')
const productController = require('../controller/productController')
const upload = require("../config/multer");


//home
router.get('/login',adminController.GetLogin)
router.post('/login',adminController.PostLogin)
router.get("/dashboard",adminAuth, adminController.GetDash)
router.post('/logout',adminAuth,adminController.logout)
router.get('/forgot-password', adminController.getForgotPass)
router.post('/sales-report', adminController.generateSalesReport);

//customer
router.get('/customers',adminAuth,customerController.getCustomer)
router.post("/confirmBlock",adminAuth,customerController.block)
//category
router.get("/categories",adminAuth,categoryController.getCategories)
router.post('/addCategories',adminAuth,categoryController.addCategories)
router.put('/editCategories/:id',adminAuth, categoryController.editCategories);
router.post('/deleteCategories',adminAuth,categoryController.deleteCategories)
router.post('/offerCategories',adminAuth,categoryController.offerCategories)
router.post('/removeOffer',adminAuth,categoryController.removeOffer)

//addProduct
router.get('/addProduct', productController.getProduct);
router.post('/addProduct', upload.array("productImages", 3), productController.postProduct);

//product
router.get('/product',adminAuth,productController.getProductList)
router.post('/productBlock',adminAuth,productController.productBlock)
router.post('/deleteProduct',adminAuth,productController.deleteProduct)
router.post('/editProduct', adminAuth,upload.array('productImage', 3), productController.editProduct);
router.post('/addOffer',adminAuth,productController.addOffer)
router.post('/removeProductOffer',adminAuth,productController.removeOffer)

//coupons
router.get('/coupons', adminAuth,productController.getCoupon)
router.post('/coupons/add', adminAuth,productController.addCoupon);
router.post('/coupons/update/:id', adminAuth,productController.updateCoupon)
router.delete('/coupons/delete/:id', adminAuth,productController.deleteCoupon)

//order
router.get('/adminOrder',adminAuth,adminController.adminOrder)
router.post('/update-order-status',adminAuth,adminController.updateOrderStatus)
router.post('/handle-return', adminAuth,adminController.handleReturn)

module.exports = router; 
