const mongoose = require("mongoose");
require('dotenv').config();


const url = process.env.MONGO_URL;
mongoose.connect(url);

mongoose.connection
    .once('open', function () {
        console.log('Successfully connected to Database Post collection ...');
    })
    .on('error', function (err) {
        console.log(err);
});



const postSchema = new mongoose.Schema({
    title:{
        type:String,
        required : true
    },
    desc :{
        type:String,
        required : true
    }, 
    photo:{
        type:String,
        default :""
    },
    username : {
        type:String,
        required : true
    },
    category : {
        type: Array
    }
}, 
// to store time by default
{timestamps : true} );

const Post = new mongoose.model("Post", postSchema);


module.exports = Post;