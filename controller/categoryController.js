
const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const { error } = require('console');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema')

const findSalesPrice = (product) => {
    const categoryOffer = product.category ? product.category.offer || 0 : 0;
    const productOffer = product.productOffer || 0;
    const effectiveOffer = Math.max(productOffer, categoryOffer);
    const effectivePrice = product.regularPrice * (1 - effectiveOffer / 100);
    const salePrice = Math.round(effectivePrice * 100) / 100;

    return { effectiveOffer, salePrice };
};

const getCategories = async (req, res) => {
    try {
         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
              
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        let limit = 9;

        // Case-insensitive search using "i" flag
        const searchQuery = { name: { $regex: search, $options: "i" } };

        let data = await Category.find(searchQuery)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        let count = await Category.countDocuments(searchQuery);

        res.render("admin/category", {
            categories: data,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            search: search,
        });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).send("Internal server error");
    }
};


const addCategories = async (req,res) => {
  try{
    const {name ,description} = req.body;
     const adminId = req.session.admin;
          const admin = await User.findOne({_id : adminId, isAdmin : true})
          if(!admin) {
            return res.redirect('/admin/login')
          }
          
if (!name || name.trim() === "" || !description) {
  return res.json({ success: false, message: "All fields are required" });
}

    let normal = name.toLowerCase().trim();
    let exisit = await Category.findOne({ name: new RegExp(`^${normal}$`, "i")})
    if(exisit) return res.json({success : false, message : "Already Exist"})
    let add = new Category({
      name : name.trim(),
       description: description?.trim() || ""
  })
  await add.save();
  res.json({ success: true, message: 'Category added successfully' });


  }catch(error) {
    console.error("Error adding category:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

const editCategories =  async (req,res) => {
    try{
        const {id} = req.params;

         const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
        const {name, description} = req.body;
        if(!name || !name.trim() || !description) {
            return res.json({success : false, message : 'All the fields are required'})
        }

        let normal = name.toLowerCase().trim();
            let find = await Category.findOne({
    _id: { $ne: id },                     
    name: new RegExp(`^${normal}$`, "i") 
});

        if(find) {
            return res.json({success : false, message : 'Category is already exist'})
        }
         let updated = await Category.findByIdAndUpdate(
            id,
            { 
                name: name.trim(),
                description: description?.trim() || "" 
            },
            );
                res.json({ success: true, message: "Category updated successfully" });
    }catch(error) {
         console.error("Error editing category:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const deleteCategories = async(req,res) => {
    try{
        const {id} = req.body;
         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
        if(!id) {
            return res.json({success : false, message : "Something Wrong!"})
        }
        let exisit = await Category.findById({_id : id})
        if(!exisit) {
            return res.json({success : false, message : 'Category not exisit'})
        }
        const {effectiveOffer,salePrice} = find
            await Category.findByIdAndDelete(id)
        return res.json({success : true, message : "Category deleted"})
    }catch(error) {
         console.error("Error deleting category:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const offerCategories = async(req,res) => {
    try{
        const { categoryId,percentage} = req.body;

         const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      
        if(!categoryId || percentage === null || !percentage) {
            return res.json({success : false, message : 'Require All Field!'})
        }
        let exisit = await Category.findById(categoryId)
        if(!exisit) {
            return res.json({success : false, message : 'Category doesnt exist'})
        }

         let updated = await Category.findByIdAndUpdate( categoryId ,{ offer : percentage})
        const products = await Product.find({category : categoryId}).populate("category")

        for(const product of products) {
            const {salePrice, effectiveOffer} = findSalesPrice(product);
            product.salePrice = salePrice;
            product.effectiveOffer = effectiveOffer
            await product.save();

        }
       
        return res.json({success : true, message : "Offer Updated Successfully"})

    }catch(error) {
         console.error('Error updating offer:', error);
    return res.status(500).json({ success: false, message: error.message ||  'Internal server error' });
    }
}

const removeOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;
         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              
        if (!categoryId) {
            return res.json({ success: false, message: "Something wrong!" });
        }

        const exist = await Category.findById(categoryId);
        if (!exist) {
            return res.json({ success: false, message: "Category does not exist" });
        }

        await Category.findByIdAndUpdate(categoryId, { offer: 0 });

        const products = await Product.find({category : categoryId}).populate("category");

        for(const product of products) {
            const {salePrice , effectiveOffer} = findSalesPrice(product);
            product.salePrice = salePrice;
            product.effectiveOffer = effectiveOffer;
            await product.save();
        }
        
        return res.json({ success: true, message: "Offer removed successfully" });
    } catch (error) {
        console.error("Error removing offer:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


module.exports = {
     getCategories,
    addCategories,
    editCategories,
    deleteCategories,
    offerCategories,
    removeOffer,
    findSalesPrice,
}