
const User = require('../schema/userSchema');
const Category = require('../schema/categorySchema')
const Product = require('../schema/productSchema')
const Transaction = require('../schema/transactionSchema')


const getWallet = async (req,res) => {
    try{
        const userId = req.session.user;
        const user = await User.findById(userId)
        if(!user) {
            res.redirect('/login')
        }
        const limit = 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1)*limit;
        
        
        const query = {userId};
        const count = await Transaction.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        const transactions = await Transaction
            .find(query)       
            .sort({ createdAt: -1 }).limit(limit).skip(skip)

           

        res.render('user/wallet', {
            user,
            transactions,
            totalPages,
            currentPage  : page,

        })
    }catch(error) {
        console.error(error);
    res.status(500).send('Server error');

    }
}

module.exports = {
    getWallet,
}