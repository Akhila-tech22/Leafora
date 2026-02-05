const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema');
const { search } = require('../routes/adminRouter');
const { adminAuth } = require('../middleware/auth');
const Coupon = require('../schema/couponSchema')


const findSalesPrice = (product) => {
    const categoryOffer = product.category ? product.category.offer || 0 : 0;
    const productOffer = product.productOffer || 0;
    const effectiveOffer = Math.max(productOffer, categoryOffer);
    const effectivePrice = product.regularPrice * (1 - effectiveOffer / 100);
    const salePrice = Math.round(effectivePrice * 100) / 100;

    return { effectiveOffer, salePrice };
};


 const getProduct = async(req,res) => {
            try{

                 const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
                let categories = await Category.find({isListed : true})
                    res.render('admin/addProduct', {
                        currentPage : "addProduct",
                        categories,
                    })
            }catch(error) {
                   console.log(error);
   res.status(500).json({ message: "Server error" });
            }
        }


const postProduct = async (req, res) => {
    try {
        const { name, category, purchasePrice, sellingPrice, offer, stock, description, author } = req.body;

         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              

        if (!req.files || req.files.length < 1) {
            return res.json({ success: false, message: "Please Upload Images!" });
        }

        if (!name || !category || !purchasePrice || !sellingPrice || !offer || !stock || !description || !author) {
            return res.json({ success: false, message: "All fields are required!" });
        }

        const exist = await Product.findOne({ productName: name });
        if (exist) {
            return res.json({ success: false, message: "Product already exists" });
        }

      
        const findCategory = await Category.findById(category);
        if (!findCategory) {
            return res.json({ success: false, message: "Category not found" });
        }

     
        const imageFilenames = req.files.map(file => file.filename);

 
        const newProduct = new Product({
            productName: name,
            category,
            author,
            description,
            regularPrice: purchasePrice,
            productOffer: offer,
            quantity: stock,
            productImage: imageFilenames 
        });

        
        const { effectiveOffer, salePrice } = findSalesPrice({
            ...newProduct.toObject(),
            category: findCategory
        });

        newProduct.effectiveOffer = effectiveOffer;
        newProduct.salePrice = salePrice;

        await newProduct.save();

        return res.json({ success: true, message: "Product added successfully" });

    } catch (error) {
        console.error("postProduct error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getProductList = async (req, res) => {
  try {
     const adminId = req.session.admin;
          const admin = await User.findOne({_id : adminId, isAdmin : true})
          if(!admin) {
            return res.redirect('/admin/login')
          }
          
    const categories = await Category.find({ isListed: true });
    let search = req.query.search || "";
    let page = req.query.page || 1;
    let limit = 9;

    let productData = await Product.find({
      productName: { $regex: ".*" + search + ".*", $options: "i" }
    })
      .populate('category')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    

    let count = await Product.countDocuments({
      productName: { $regex: ".*" + search + ".*", $options: "i" }
    });

    res.render('admin/product', {
      products: productData,
      categories,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      search: search
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

const productBlock = async (req,res) => {
    try{
        const {productId, action} = req.body;

         const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
        if(!productId || !action) {
            return res.json({success : false, message : "Something Wrong!"})
        }

        let product = await Product.findById(productId);
        if(!product) {
            return res.json({success : false, message : "Internal issuess"})
        }
        if(action === "block") {
            await Product.findByIdAndUpdate(productId, {isBlocked : true})
        } else {
            await Product.findByIdAndUpdate(productId,{isBlocked : false})
        }
        return res.json({success : true, message : "Successfully"})

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const deleteProduct= async (req,res) => {
    try{
        const {productId} = req.body;

         const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
        if(!productId) {
            return res.json({success : false, message : "Something Wrong!"})
        }
        const product = await Product.findById(productId);
        if(!product) {
            return res.json({success : false, message : "Internal Issuess"})
        }
         await Product.findByIdAndDelete(productId)
         return res.json({success : true, message : "Delete Successfully"})
    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}


const editProduct = async (req, res) => {
    try {
        const { productId, productName, description, regularPrice, sellingPrice, quantity, category, author, existingImages } = req.body;

         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              

        if (!productId || !productName || !description || !regularPrice || !sellingPrice || !quantity || !category || !author) {
            return res.json({ success: false, message: "Missing required fields!" });
        }

      if (Number(sellingPrice) > Number(regularPrice)) {
    return res.json({
        success: false,
        message: 'Selling price cannot be greater than regular price!'
    });
}


     
        let updateData = {
            productName,
            description,
            regularPrice,
            salePrice: sellingPrice,
            quantity,
            category,
            author,
        };

        let finalImages = [];

if (existingImages) {
  const imgs = Array.isArray(existingImages) ? existingImages : [existingImages];
  finalImages = imgs;
}

if (req.files?.length) {
  finalImages.push(...req.files.map(f => f.filename));
}

finalImages = finalImages.slice(0, 3);


        if (finalImages.length > 0) {
            updateData.productImage = finalImages;
        }

        const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });

        if (!updatedProduct) {
            return res.json({ success: false, message: "Product not found" });
        }

        return res.json({ success: true, message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        console.error("editProduct error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const addOffer = async (req, res) => {
      console.log("Body received:", req.body); 
    try {
        const { percentage, productId } = req.body;

         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
        if (!percentage || !productId) {
            return res.json({ success: false, message: "Something Wrong!" });
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.json({ success: false, message: "Internal Error" });
        }

        product.productOffer = percentage;

        const { effectiveOffer, salePrice } = findSalesPrice(product);
        product.effectiveOffer = effectiveOffer;
        product.salePrice = salePrice;

        await product.save();

        return res.json({ success: true, message: "Offer added successfully" });
    } catch (error) {
        console.error("addOffer error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};



const removeOffer = async (req, res) => {
    try {
        const { productId } = req.body;
         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
        if (!productId) {
            return res.json({ success: false, message: "Something Wrong!" });
        }

        const product = await Product.findById(productId).populate('category');
        if (!product) {
            return res.json({ success: false, message: "Internal Error" });
        }

        product.productOffer = 0;

        const { effectiveOffer, salePrice } = findSalesPrice(product);
        product.effectiveOffer = effectiveOffer;
        if(effectiveOffer) {
            product.salePrice = salePrice;
            await product.save();
        } else {
        product.salePrice = product.regularPrice;
        await product.save();
        }
  

        return res.json({ success: true, message: "Offer removed successfully" });
    } catch (error) {
        console.error("removeOffer error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getCoupon = async (req,res) => {
    try{    
         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
    
        const coupons = await Coupon.find();
        res.render('admin/adminCoupon', {
            coupons,
            currentPage: 'coupons' 
        })

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const addCoupon = async (req,res) => {
    try{    
           const {
            name,
            offerPrice,
            minimumPrice,
            expireOn
        } = req.body;

         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
        const isDup = await Coupon.findOne({name})
        if(isDup) {
                 return res.json({ success: false, message: "Coupon already exist!" });
        }

        const newCoupon = new Coupon({
            name, 
            offerPrice,
            minimumPrice,
            expireOn
        })
        await newCoupon.save();
             return res.json({ success: true, message: "Coupon add successfully" });

    }catch(error) {
           console.log(error);
   res.status(500).json({ message: "Server error" });
    }
}

const updateCoupon = async (req,res) => {
    try{
        const id = req.params.id;
         const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
        const {name , offerPrice, minimumPrice, expireOn} = req.body;
        if(!id) {
            return res.json({status : false, message : "Something error!"})
        }

        const isDup = await Coupon.findOne({name, _id : {$ne : id}})
        if(isDup) {
            return res.json({status : false, message : "Coupon is already exist!"})
        }
        const updated = await Coupon.findByIdAndUpdate(id, {
            name ,
            offerPrice,
            minimumPrice,
            expireOn
        })
        if(!updated) {
            return res.json({status : false, message : "Coupon is not found"})
        }

        res.json({ success: true, message: 'Coupon updated successfully' });



    }catch(error) {
          console.error(err);
        res.json({ success: false, message: 'Failed to update coupon' });
    }
}

    const deleteCoupon = async (req,res) => {
        try{
            const id = req.params.id;
             const adminId = req.session.admin;
                  const admin = await User.findOne({_id : adminId, isAdmin : true})
                  if(!admin) {
                    return res.redirect('/admin/login')
                  }
                  
            if(!id) {
                return res.json({sucess : false, message : "Something error!"})
            }
            const isExist = await Coupon.findById(id);
            if(!isExist) {
                return res.json({success : false, message : "Coupon is not found!"})
            }
             await Coupon.findByIdAndDelete(id)
            res.json({ success: true, message: 'Coupon deleted successfully' });

        }catch(error) {
             console.error(error);
        res.json({ success: false, message: "Failed to delete coupon" });
        }
    }


        module.exports = {
            getProduct,
            postProduct,
            getProductList,
            productBlock,
            deleteProduct,
            editProduct,
            addOffer,
            removeOffer,
            findSalesPrice,
            getCoupon,
            addCoupon,
            updateCoupon,
            deleteCoupon,
        }