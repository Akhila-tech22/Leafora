 require('dotenv').config();
const express = require('express')
const session = require('express-session');
const app = express();
const PORT= process.env.PORT
const userRoutes = require('./routes/userRouter')
const adminRoutes = require('./routes/adminRouter')
const db = require('./config/db')
const path = require('path');
const passport = require('./config/passportConfig');
db();

app.use(session({
    secret: process.env.SESSION_SECRET, // from your .env
    resave: false, // don’t save session if nothing changed
    saveUninitialized: true, // save new sessions even if empty
    cookie: {
        secure: false, // set true if using HTTPS
        httpOnly: true, // can’t be accessed by client JS
        maxAge: 72 * 60 * 60 * 1000 // 72 hours
    }
}));


app.use(express.static(path.join(__dirname, 'public')));

// Caching disabled
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
// app.use('/uploads', express.static('uploads'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine','ejs')


app.use(express.json())
app.use(express.urlencoded ({extended :true}))
app.use('/admin', adminRoutes)
app.use('/',userRoutes)


app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

