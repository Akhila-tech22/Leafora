const User = require("../schema/userSchema")

const userAuth = async (req,res,next) => {
    try{
        if(!req.session.user) {
           return  res.redirect("/login")
        }
        let user = await User.findById(req.session.user) 

        if(!user) {
            req.session.destroy(() => {});
            return res.redirect("/login");
        }

        if(user.isBlocked) {
            req.session.destroy(() => {})
            return res.redirect("/login")
        }
        next();



    }catch(error) {
          console.log("User Auth Error", error);
        res.status(500).send("Internal Server Error");
    }
}

const adminAuth = async (req,res,next) => {
    try {
        if (!req.session.admin) {
            return res.redirect("/admin/login");   // ✅ correct path
        }

        let admin = await User.findById(req.session.admin);
        if (!admin) {
            req.session.destroy(() => {});
            return res.redirect("/admin/login");   // ✅ correct path
        }
        next();
    } catch(error) {
        console.log("Admin Auth Error", error);
        res.status(500).send("Internal Server Error");
    }
};


module.exports = {userAuth,adminAuth }