const mongoose = require('mongoose')
const env = require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("connect DB")
    } 
    catch(error) {
         console.log("DB connection error", error.message)
        process.exit(1)  // stops/kills your Node.js application immediately.process is current running process. 0 => sucess, normal exit, 1 => failure, error happend
    }
}

module.exports = connectDB