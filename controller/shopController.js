const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const { error } = require('console');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema');
const Cart = require('../schema/cartSchema')


const findSalesPrice = async(product)=> {
    let categoryOffer = product.category ? product.category.offer : 0;
    let productOffer = product ? product.productOffer : 0;
    let effectiveOffer = Math.max(productOffer,categoryOffer)
    let effectivePrice = product.regularPrice * (1 - effectiveOffer / 100);

      return Math.round(effectivePrice * 100) / 100;
}

const getShop = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const searchText = req.query.query || "";
    const sortBy = req.query.sortBy || "";

    let filter = {
      quantity: { $gte: 1 },
      isBlocked: false
    };

  
    const matchingCategories = await Category.find({
      name: { $regex: searchText, $options: "i" },
      isListed: true
    }).select('_id');

    const categoryIds = matchingCategories.map(c => c._id);

    if (searchText) {
      filter.$or = [
        { productName: { $regex: searchText, $options: "i" } },
        { author: { $regex: searchText, $options: "i" } },
        { category: { $in: categoryIds } }
      ];
    }

    
    const limit = 7;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

   
    const countDoc = await Product.countDocuments(filter);
    const totalPages = Math.ceil(countDoc / limit);

    let productsQuery = Product.find(filter).populate('category');


    if (sortBy === "price_low") productsQuery.sort({ salePrice: 1 });
    if (sortBy === "price_high") productsQuery.sort({ salePrice: -1 });
    if (sortBy === "name_az") productsQuery.sort({ productName: 1 });
    if (sortBy === "name_za") productsQuery.sort({ productName: -1 });
    if (sortBy === "newest") productsQuery.sort({ createdAt: -1 });

    const products = await productsQuery
      .skip(skip)
      .limit(limit);

    const categories = await Category.find({ isListed: true });

    res.render("user/shop", {
      products,
      categories,
      query: searchText,
      sortBy,
      currentPage: page,      
      totalPages,
      totalProducts  : countDoc,         
      user: req.session.userName
    });

  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
};


const details = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).send("ProductId missing");

        let product = await Product.findById(id);
        if (!product) return res.status(404).send("Product not found");

        let similarProducts = await Product.find({ quantity: { $gte: 10 }, isBlocked: false });
       
        res.render("user/productDetails", { product, similarProducts , 
             user: req.session.userName || null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};





module.exports = {
    getShop,
    details,
    findSalesPrice,
   
}