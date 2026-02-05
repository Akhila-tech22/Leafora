
const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Order = require('../schema/orderSchema')
const Transaction = require('../schema/transactionSchema');
const Coupon = require('../schema/couponSchema');
const Product = require('../schema/productSchema');

const GetLogin = async (req, res) => {
    try {
        res.render("admin/login");
    } catch (error) {
        console.error("Login Page error", error);
    }
};


const PostLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    let errors = {};

    const admin = await User.findOne({ email: email, isAdmin: true });

    if (!email) {
      errors.email = "Please Enter Email";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = "Please enter valid Email";
      }
    }

    if (!admin) {
      errors.email = "Incorrect Email";
    }

    if (!password) {
      errors.password = "Please Enter Password";
    } else if (admin) {  
      const hash = await bcrypt.compare(password, admin.password);
      if (!hash) {
        errors.password = "Invalid Password";
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.json({ success: false, errors });
    }

    req.session.admin = admin._id;
    return res.json({ success: true });
  } catch (error) {
    console.error("PostLogin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


const GetDash = async (req, res) => {
    try {
      const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }

      const totalCustomers = await User.countDocuments({isAdmin : false})
      const totalOrders = await Order.countDocuments();
      const totalProducts = await Product.countDocuments();


      const revenue  = await Order.aggregate([{$match : {paymentStatus : 'completed'}},
        {$match : {orderedItems : {$elemMatch : {status : {$nin : ['approved', 'cancelled']}}}}},
        {$group : {_id : null, total : {$sum : "$finalAmount"}}}
      ])
       const totalRevenue = revenue[0]?.total || 0;

       const topProducts = await Order.aggregate([{$unwind : "$orderedItems"},
        {$match : {'orderedItems.status' : {$nin : ['approved', 'cancelled']}}},
        {$group : {_id : '$orderedItems.product', productName : {$first : '$orderedItems.productName'}, sold : {$sum : '$orderedItems.quantity'}, price : {$first : '$orderedItems.price'}, revenue  : {$sum : {$multiply : ['$orderedItems.price' , '$orderedItems.quantity'] }}}},
        {$sort : {sold : -1}},
        {$limit : 10},
        {$lookup : {from : 'products', localField : '_id', foreignField : '_id', as : 'productDetails'}},
        {$unwind : '$productDetails'},
        {$lookup : {from :'categories', localField : 'productDetails.category', foreignField : '_id', as : 'categoryDetails'}},
        {$unwind : '$categoryDetails'},
        {$project : { productId: "$_id", productName : 1, sold : 1, price : 1,revenue  : 1, categoryName : '$categoryDetails.name'}},
        
       ])

        const recentOrders = await Order.find()
        .sort({createdOn : -1})
        .limit(10)
        .populate('userId', 'name')
         .select('orderId finalAmount userId');

         const formattedRecentOrders = recentOrders.map(order => ({
            orderId: order.orderId,
            customerName: order.userId.name,
            finalAmount: order.finalAmount
        }));
       
        res.render("admin/dashboard", {
          currentPage: 'dashboard',
          totalCustomers,
          totalProducts,
          totalOrders,
          totalRevenue,
          topProducts,
          recentOrders: formattedRecentOrders
          
        })
    } catch (error) {
        console.error("Login Page error", error);
    }
};

const adminOrder = async (req, res) => {
  try {
    const { search, status, payment } = req.query;

    let query = {
      paymentStatus: { $ne: 'failed' }
    };

    if (status) {
      query.orderedItems = { $elemMatch: { status } };
    }

    if (payment) {
      query.paymentMethod = payment;
    }

    let limit = 10;
    let page = parseInt(req.query.page) || 1;

    // DB fetch (NO pagination here)
    let orders = await Order.find(query)
      .populate('userId', 'name email')
      .sort({ createdOn: -1 });

    //  JS SEARCH
    if (search && search.trim() !== '') {
      const key = search.toLowerCase();

      orders = orders.filter(order =>
        order.orderId.toLowerCase().includes(key) ||
        order.userId.name.toLowerCase().includes(key) ||
        order.orderedItems.some(item =>
          item.productName.toLowerCase().includes(key)
        )
      );
    }

   
    const totalOrders = orders.length;
    const totalPages = Math.ceil(totalOrders / limit);

    //  PAGINATION
    const start = (page - 1) * limit;
    const end = start + limit;
    orders = orders.slice(start, end);

    res.render('admin/orderMgt', {
      orders,
      currentPage: 'orderMgt',
      search,
      statusFilter: status,
      paymentFilter: payment,
      totalPages,
      page
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};


const updateOrderStatus = async (req,res) => {
  try{
    const {orderId, itemId, status} = req.body;
     const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
    if(!orderId || !itemId || !status) {
      return res.json({success : false, message : "Something Wrong!"})
    }
    const order = await Order.findById(orderId)
    if(!order) {
      return res.json({success : false, message : "Order is not found!"})
    }
    
    const item = order.orderedItems.find(
  i => i._id.toString() === itemId 
);
    if(!item) {
      return res.json({success : false, message : "Item is missing!"})
    }
    if (status === 'delivered' && order.paymentMethod === 'cod') {
  order.paymentStatus = 'completed';
}
    
  item.status = status;
  order.updatedAt = Date.now();
    await order.save();
    res.json({ success: true, message: 'Status updated successfully' });

  }catch(error) {
       console.log(error);
   res.status(500).json({ message: "Server error" });
  }
}




const handleReturn = async (req, res) => {
  try {
    const { orderId, itemId, decision } = req.body;
     const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      

    if (!orderId || !itemId || !decision) {
      return res.json({ success: false, message: "Something Wrong!" });
    }

    const order = await Order.findById(orderId).populate('orderedItems.product');
    if (!order) {
      return res.json({ success: false, message: "Order not found!" });
    }

    const item = order.orderedItems.find(
      i => i._id.toString() === itemId
    );
    if (!item) {
      return res.json({ success: false, message: "Item is not found!" });
    }


    
    if (decision === 'approved') {

  
      if (item.status === 'approved') {
        return res.json({ success: false, message: "Already approved!" });
      }

      const cancelFinal = item.price * item.quantity;  

       

      let newSubTotal = order.orderedItems
            .filter(i => i._id.toString() !== itemId && i.status !== 'approved')
            .reduce((sum , i) => sum + i.price * i.quantity, 0)
      
      let discount = order.discount || 0;
      let newFinalAmount = newSubTotal - discount + order.deliveryCharge;


      if (order.couponApplied && order.couponDetails?.couponId) {
        const coupon = await Coupon.findById(order.couponDetails.couponId);

        if (coupon && coupon.minimumPrice > newSubTotal) {
          
          order.couponApplied = false;
          order.couponDetails = null;

          // restore discount amount
          newFinalAmount += order.discount;
          order.discount = 0;
        }
      }

      item.status = 'approved';
      order.totalPrice = newSubTotal;
      order.finalAmount = newFinalAmount;
      order.updatedOn = new Date();

      
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity }
      });

    
      const user = await User.findById(order.userId);
      user.wallet += cancelFinal;
      await user.save();

     
      const transaction = new Transaction({
        userId: order.userId,
        amount: cancelFinal,
        transactionType: 'credit',
        paymentMethod: order.paymentMethod,
        status: 'completed',
        purpose: 'return',
        description: `Return approved for ${item.productName}, qty ${item.quantity}`,
        orders: [{
          orderId: order.orderId,
          amount: cancelFinal
        }],
        walletBalanceAfter: user.wallet
      });

      await transaction.save();
      await order.save();

      return res.json({
        success: true,
        message: "Return approved successfully"
      });
    }


    if (decision === 'rejected') {
      item.status = 'rejected';
      order.updatedOn = new Date();
      await order.save();

      return res.json({
        success: true,
        message: "Return rejected"
      });
    }

  } catch (error) {
    console.error(error);
    return res.json({ success: false, message: "Server Error" });
  }
}; 

const logout = async (req,res) => {
  try{
    req.session.destroy((error) => {
      if(error) {
        console.log("Error happend in admin logout!")
      }
      return res.redirect('/admin/login')
    })

  }catch(error) {
       console.log(error);
   res.status(500).json({ message: "Server error" });
  }
}

const getForgotPass = async (req,res) => {
  try{
    req.session.role = 'admin';
    res.render('admin/adminForgotPass')
  }catch(error) {
       console.log(error);
   res.status(500).json({ message: "Server error" });
  }
}

const emailCheck = async (req,res) => {
  try{
    const { email } = req.body;
        const user = await User.findOne({ email: email });
        res.json({ exists: !!user });
       

  }catch(error) {
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
            return res.redirect('/admin/forgot-password');
        }
        res.redirect('/adminForgot-otp')
    

  }catch(error) {
    console.error("Forgot OTP error:", error);
  }
}

const generateSalesReport = async (req, res) => {
    try {
        console.log('Generating sales report...', req.body);

        const { filterType, startDate, endDate } = req.body;

        let dateFilter = {};
        const now = new Date();

        // Calculate date range based on filter type
        if (filterType === 'today') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            const endOfDay = new Date(now.setHours(23, 59, 59, 999));
            dateFilter = { createdOn: { $gte: startOfDay, $lte: endOfDay } };
        } else if (filterType === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            dateFilter = { createdOn: { $gte: startOfWeek } };
        } else if (filterType === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { createdOn: { $gte: startOfMonth } };
        } else if (filterType === 'year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            dateFilter = { createdOn: { $gte: startOfYear } };
        } else if (filterType === 'custom') {
            if (!startDate || !endDate) {
                return res.json({ success: false, message: 'Please provide both start and end dates' });
            }
            dateFilter = {
                createdOn: {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                }
            };
        }

        console.log('Date filter:', dateFilter);

        const orders = await Order.find(dateFilter)
            .populate('userId', 'name')
            .sort({ createdOn: -1 });

        console.log('Found orders:', orders.length);

       
        const report = [];
        
        orders.forEach((order, orderIndex) => {
            console.log(`\n=== Order ${orderIndex + 1} ===`);
            console.log('Order ID:', order.orderId);
            console.log('Total Items:', order.orderedItems.length);
            
          
            order.orderedItems.forEach((item, itemIndex) => {
                console.log(`  Item ${itemIndex + 1}: ${item.productName} - Status: ${item.status}`);
            });

      

            const activeItems = order.orderedItems.filter(item => {
                if(item.status === 'cancelled' || item.status === 'payment_failed' || item.status === 'approved') {
                  return false;
                }
                if(order.paymentMethod === 'cod' && order.paymentStatus !== 'completed') {
                  return false;
                }

                return true;
            })

            
            console.log('Active items:', activeItems.length);

           
            if (activeItems.length === 0) {
                console.log('Skipping order - no active items');
                return;
            }

            const orderSubtotal = activeItems.reduce((sum, item) => 
                sum + (item.price * item.quantity), 0
            );

            console.log('Order subtotal:', orderSubtotal);

            const orderCouponDiscount = order.couponApplied ? 
                (order.couponDetails?.discountAmount || 0) : 0;

            console.log('Coupon discount:', orderCouponDiscount);

         
            const deliveryPerItem = order.deliveryCharge / activeItems.length;

            activeItems.forEach((item, itemIndex) => {
               
                const itemTotal = item.price * item.quantity;
                const itemPercentage = orderSubtotal > 0 ? itemTotal / orderSubtotal : 0;

                const itemCouponDiscount = orderCouponDiscount * itemPercentage;

           
                const itemFinalAmount = itemTotal - itemCouponDiscount + deliveryPerItem;

                console.log(`  Adding item ${itemIndex + 1} to report:`, {
                    product: item.productName,
                    itemTotal,
                    discount: itemCouponDiscount,
                    final: itemFinalAmount
                });

                report.push({
                    date: order.createdOn,
                    orderId: order.orderId,
                    customer: order.userId?.name || 'Unknown',
                    product: item.productName,
                    salesAmount: itemTotal,
                    discount: itemCouponDiscount,
                    couponCode: order.couponApplied ? order.couponDetails?.couponCode || '' : '',
                    finalAmount: itemFinalAmount
                });
            });
        });

        console.log('\n=== FINAL REPORT ===');
        console.log('Report items:', report.length);

        res.setHeader('Content-Type', 'application/json');
        res.json({
            success: true,
            report
        });

    } catch (error) {
        console.error('Sales report error:', error);
       
        res.setHeader('Content-Type', 'application/json');
        res.json({ 
            success: false, 
            message: 'Failed to generate report',
            error: error.message 
        });
    }
};



module.exports = {
    GetLogin,
    PostLogin,
    GetDash,
    adminOrder,
    updateOrderStatus,
   handleReturn,
   logout,
   getForgotPass,
   emailCheck,
   checkForgotPassOtp,
   generateSalesReport,
};
