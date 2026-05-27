const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: "dobdyitbe",
  api_key: "319997681833546",
  api_secret: "9frVBzBS0uzqFaK0qfxvu4--1Gg",
});

module.exports = cloudinary;