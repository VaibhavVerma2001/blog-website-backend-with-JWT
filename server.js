const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
const User = require("./db/user");
const Post = require("./db/post");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const verify = require('./verifyToken');




const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
// make image folder public
app.use("/images", express.static(path.join(__dirname, "/images")));


//set image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "images");
    },
    filename: (req, file, cb) => {
        cb(null, req.body.name);
    },
});

const upload = multer({ storage: storage });
app.post("/api/upload", upload.single("file"), (req, res) => {
    res.status(200).json("File has been uploaded");
});


// ********************* Authentication******************

//register
app.post('/api/auth/register', async (req, res) => {

    const newUser = new User({
        username: req.body.username,
        email: req.body.email,
        password: CryptoJS.AES.encrypt(
            req.body.password,
            process.env.SECRET_KEY
        ).toString(),
    });
    try {
        const user = await newUser.save();
        res.status(201).json({ success: true, user });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, err });
    }
});


// login
app.post('/api/auth/login', async (req, res) => {
    try {
        // with username and password
        let user = await User.findOne({ username: req.body.username });
        if (!user) {
            // means that email dont exists 
            console.log("Please login with correct credentials");
            return res.status(400).json({ success: false, msg: "Please login with correct credentials" });
        }

        const bytes = CryptoJS.AES.decrypt(user.password, process.env.SECRET_KEY);
        const originalPassword = bytes.toString(CryptoJS.enc.Utf8);


        if (originalPassword !== req.body.password) {
            console.log("Please login with correct credentials");
            return res.status(401).json({ success: false, msg: "Please login with correct credentials" });
        } else {
            const accessToken = jwt.sign(
                { id: user._id },
                process.env.SECRET_KEY,
                { expiresIn: "5d" }
            );
            const { password, ...others } = user._doc;
            res.status(200).json({ success: true, user: others, accessToken });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, err });
    }
});



// ********************* CRUD OPERATION ON USER TO CHANGE PROFILE SETTINGS******************

// update user
app.put('/api/users/update/:id', verify, async (req, res) => {
    // check if right user trying to update only , userId provided by user

    if (req.user.id === req.params.id) {
        if (req.body.password) {
            req.body.password = CryptoJS.AES.encrypt(
                req.body.password,
                process.env.SECRET_KEY
            ).toString();
        }

        try {
            // to update old posts username
            const user = await User.findById(req.params.id);

            const updatedUser = await User.findByIdAndUpdate(
                req.params.id,
                {
                    // everything , username,email,password,profilePic
                    $set: req.body,
                },
                { new: true }
            );

            // also update usernamename of old saved posts of that user
            const response = await Post.updateMany({ username: user.username }, { username: updatedUser.username });

            res.status(200).json(updatedUser);
        } catch (err) {
            // username or email already taken
            res.status(500).json(err);
        }
    } else {
        res.status(403).json("You can update only your account!");
    }
});


// delete user
app.delete('/api/users/delete/:id', verify, async (req, res) => {
    // check if right user trying to update only , userId provided by user
    if (req.user.id === req.params.id) {
        try {
            const user = await User.findById(req.params.id);
            try {
                //1st delete all posts of that user
                await Post.deleteMany({ username: user.username });
                // then User delete account
                await User.findByIdAndDelete(req.params.id);
                res.status(200).json({ success: true, msg: "User has been deleted..." });
            } catch (err) {
                res.status(500).json({ success: false, msg: err });
            }
        } catch (err) {
            console.log(err);
            res.status(404).json({ success: false, msg: "User not found!" });
        }
    } else {
        res.status(401).json({ success: false, msg: "You can delete only your account!" });
    }
});


//GET USER
app.get("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const { password, ...others } = user._doc;
        res.status(200).json(others);
    } catch (err) {
        res.status(500).json(err);
    }
});



// ********************* CRUD OPERATION ON POST******************


//CREATE POST
app.post("/api/posts/createpost", verify, async (req, res) => {
    // title,desc,username is required
    if (req.user.id === req.body.userId) {
        const newPost = new Post(req.body);
        try {
            const savedPost = await newPost.save();
            res.status(200).json(savedPost);
        } catch (err) {
            console.log(err);
            res.status(500).json(err);
        }
    }
    else {
        res.status(403).json("You are not Authenticated!");
    }

});


//UPDATE POST
app.put("/api/posts/update/:id", verify, async (req, res) => {
    try {
        try {
            const updatedPost = await Post.findByIdAndUpdate(
                req.params.id,
                {
                    $set: req.body,
                },
                { new: true }
            );
            res.status(200).json(updatedPost);
        } catch (err) {
            res.status(500).json(err);
        }
    } catch (err) {
        res.status(500).json(err);
    }
});


//DELETE POST
app.delete("/api/posts/delete/:id", verify, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        try {
            await post.delete();
            res.status(200).json("Post has been deleted...");
        } catch (err) {
            res.status(500).json(err);
        }
    } catch (err) {
        res.status(500).json(err);
    }
});


//GET SPECIFIC POST
app.get("/api/posts/:id", async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        res.status(200).json(post);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});




// QUERY -- 
// /api/posts/?user="john" means fetch all data of john
//GET ALL POSTS 
app.get("/api/posts",verify, async (req, res) => {
    const username = req.query.user;
    const catName = req.query.cat;
    try {
        let posts;
        if (username) {
            posts = await Post.find({ username });
        } else if (catName) {
            posts = await Post.find({
                categories: {
                    $in: [catName],
                },
            });
            // if no query then fetch all posts
        } else {
            posts = await Post.find({});
        }
        res.status(200).json(posts);
    } catch (err) {
        res.status(500).json(err);
    }
});


const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});