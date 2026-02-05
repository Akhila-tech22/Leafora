
const mongoose = require('mongoose');
const User = require('../schema/userSchema');
const { error } = require('console');
const bcrypt = require("bcryptjs");
const Category = require('../schema/categorySchema')


const getCustomer = async (req,res) => {
  try {
     const adminId = req.session.admin;
      const admin = await User.findOne({_id : adminId, isAdmin : true})
      if(!admin) {
        return res.redirect('/admin/login')
      }
      

    let search = "";
    if(req.query.search) {
      search = req.query.search;
    }
    let page =1;
    if(req.query.page) {
      page = req.query.page;
    }
    let limit = 9;
    let userData = await User.find({
      isAdmin : false,
      $or : [{name : {$regex : ".*"+search+ ".*"}},{email : {$regex : ".*"+search+".*"}}]
    }).sort({createdAt : -1})
    .limit(limit *1)
    .skip((page -1) * limit)

        let count = await User.countDocuments({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } }
      ]
    });

    res.render("admin/customer", {
      customers : userData,
      currentPage : page,
      totalPages:Math.ceil(count/limit),
      search : search,
    })


  }catch(error) {

  }
}


const block = async (req, res) => {
    try {
        const { action, id } = req.body;
         const adminId = req.session.admin;
              const admin = await User.findOne({_id : adminId, isAdmin : true})
              if(!admin) {
                return res.redirect('/admin/login')
              }
              

        if (!action || !id) {
            return res.json({ success: false, message: "Internal problem" });
        }

        let user = await User.findById(id);
        if (!user) {
            return res.json({ success: false, message: "Can't find user" });
        }

        user.isBlocked = (action === "block");


        await user.save();
        return res.json({ success: true });
    } catch (error) {
        console.error(error);
        return res.json({ success: false, message: "Server error" });
    }
};

module.exports = {
    block,
    getCustomer,

};