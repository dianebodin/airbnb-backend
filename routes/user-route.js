const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const mailgun = require("mailgun-js");

const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");

const User = require("../models/user-model");
const Room = require("../models/room-model");
const isAuthenticated = require("../middlewares/isAuthenticated");

const cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


//create user -> inscription
router.post("/user/sign_up", async (req, res) => {
  try {
    if (req.fields.email && req.fields.username && req.fields.name && req.fields.description && req.fields.password) {
      if (req.fields.email.trim().length > 0 && req.fields.username.trim().length > 0 && req.fields.name.trim().length > 0 && req.fields.description.trim().length > 0) {
        if (/^[a-zA-Z0-9.-]+@[a-zA-Z0-9]+\.[a-zA-Z]+$/.test(req.fields.email)) { //format mail correct
          const u_email = await User.findOne({ email: req.fields.email }); //doublon email
          if (!u_email) {
            const u_username = await User.findOne({ "account.username": req.fields.username }); //doublon username
            if (!u_username) {
              if (req.fields.password.length >= 5) {
                const salt_save = uid2(16);
                const newUser = new User({
                  email: req.fields.email,
                  account: {
                    username: req.fields.username.trim(),
                    name: req.fields.name.trim(),
                    description: req.fields.description.trim(),
                  },
                  token: uid2(16),
                  salt: salt_save,
                  hash: SHA256(req.fields.password + salt_save).toString(encBase64),
                });

                await newUser.save();
                return res.status(200).json({ token: newUser.token, account: newUser.account });

              } else return res.status(400).json({ error: "Password must contain less than 5 characters" });
            } else return res.status(400).json({ error: "Username already used" });
          } else return res.status(400).json({ error: "Email already used" });
        } else return res.status(400).json({ error: "Email: incorrect format" });
      } else return res.status(400).json({ error: "All fields must be completed correctly" });
    } else return res.status(400).json({ error: "Missing parameters" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});


//connexion
router.post("/user/log_in", async (req, res) => {
  try {
    if (req.fields.email && req.fields.password) {

      const u = await User.findOne({ email: req.fields.email });

      if (u) {
        if (u.hash === SHA256(req.fields.password + u.salt).toString(encBase64)) {

          //user connecté
          return res.status(200).json({ token: u.token, account: u.account });

        } else return res.status(400).json({ error: "Wrong password" });
      } else return res.status(404).json({ error: "Email not found" });
    } else return res.status(400).json({ error: "Missing parameters" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});


//user identifié par son id (params)
router.get("/user/:id", async (req, res) => {
  if (req.params.id){
    try {
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        const u = await User.findById(req.params.id);
        if (u) {

          return res.status(200).json({ id: u.id, account: u.account, rooms: u.rooms });
            
        } else return res.status(404).json({ error: "User not found" });
      } else return res.status(400).json({ error: "Wrong id" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


//rooms d'un user identifié par son id (params)
router.get("/user/rooms/:id", async (req, res) => {
  if (req.params.id){
    try {
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        const u = await User.findById(req.params.id);
        if (u) {

          if (u.rooms) {
            let tab = [];
            for (let i = 0; i < u.rooms.length; i++) {
              const r = await Room.findById(u.rooms[i]);
              tab.push(u);
            }

            return res.status(200).json(tab);

          } else return res.status(404).json({ error: "This user has no room" });
        } else return res.status(404).json({ error: "User not found" });
      } else return res.status(400).json({ error: "Wrong id" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


//update user - email, username, name, description
router.put("/user/update/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    try {
      if (req.user) {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
          const u = await User.findById(req.params.id);
          if (u) {
            if (u.token === req.user.token) {

              if(req.fields.email || req.fields.username || req.fields.name || req.fields.description) {

                if (req.fields.email && req.fields.email.trim().length > 0) {
                  if (/^[a-zA-Z0-9.-]+@[a-zA-Z0-9]+\.[a-zA-Z]+$/.test(req.fields.email)) {
                    const check_email = await User.findOne({ email: req.fields.email }); //doublon email
                    if (!check_email) {
                      await User.findByIdAndUpdate(req.params.id, { email: req.fields.email});
                    } else return res.status(400).json({ error: "Email already used" });
                  } else return res.status(400).json({ error: "Email: incorrect format" });
                }

                if (req.fields.username && req.fields.username.trim().length > 0) {
                  const check_username = await User.findOne({ "account.username": req.fields.username }); //doublon username
                  if (!check_username) {
                    await User.findByIdAndUpdate(req.params.id, { "account.username": req.fields.username });
                  } else return res.status(400).json({ error: "Username already used" });
                }

                if (req.fields.name && req.fields.name.trim().length > 0) {
                  await User.findByIdAndUpdate(req.params.id, { "account.name": req.fields.name });
                }

                if (req.fields.description && req.fields.description.trim().length > 0) {
                  await User.findByIdAndUpdate(req.params.id, { "account.description": req.fields.description });
                }

                const userUpdated = await User.findById(req.params.id); //mise à jour
                return res.status(200).json({ id: userUpdated.id, email: userUpdated.email, account: userUpdated.account, rooms: userUpdated.rooms });

              } else return res.status(400).json({ error: "Missing parameters" });
            } else return res.status(401).json({ error: "User unauthorized" });
          } else return res.status(404).json({ error: "User not found" });
        } else return res.status(400).json({ error: "Wrong id" });
      } else return res.status(401).json({ error: "User unauthorized" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


//update password
router.put("/user/update_password", isAuthenticated, async (req, res) => {
  if (req.fields.previousPassword && req.fields.newPassword) {
    try {
      if (req.user) {
        const u = await User.findById(req.user.id);
        
        if (SHA256(req.fields.previousPassword + u.salt).toString(encBase64) === u.hash) {
          if (SHA256(req.fields.previousPassword + u.salt).toString(encBase64) !== SHA256(req.fields.newPassword + u.salt).toString(encBase64)) {
            if (req.fields.newPassword.length >= 5) {

              const salt = uid2(64);
              const hash = SHA256(req.fields.newPassword + salt).toString(encBase64);
              const userUpdate = await User.findByIdAndUpdate(req.user.id, { salt: salt, hash: hash });
              await userUpdate.save();
              return res.status(200).json({ message: "Password successfully modified" });

            } else return res.status(400).json({ error: "Password must contain less than 5 characters" });
          } else return res.status(401).json({ error: "Previous password and new password must be different" });
        } else return res.status(401).json({ error: "Wrong previous password" });
      } else return res.status(401).json({ error: "User unauthorized" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing parameters" });
});


//mot de passe oublié -> utilisation de l'api mailgun
router.post("/user/recover_password", async (req, res) => {
  if (req.fields.email) {
    try {
      const u = await User.findOne({ email: req.fields.email });

      if (u) {
        const userEmail = u.email;
        const userToken = u.token;

        const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN });

        const data = {
          from: "Airbnb API <postmaster@" + process.env.MAILGUN_DOMAIN + ">",
          to: userEmail,
          subject: "Change your password on Airbnb",
          text: `Please, click on the following link to change your password: https://airbnb/change_password?token=${userToken}`
        };

        mg.messages().send(data, function (error, body) {
          //console.log(body);
          //console.log(error);
        });

        return res.status(200).json({ message: "A link has been sent to the user" });

      } else return res.status(404).json({ error: "User not found" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing email" });
});


//update sa photo personnelle
router.put("/user/upload_picture/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    if (req.files.picture) {
      try {
        if (req.user) {
          if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            const u = await User.findById(req.params.id);
            if (u) {
              if (u.token === req.user.token) {

                //si existe, supprimer de cloudinary avant de remplacer
                if (u.account.picture !== null) await cloudinary.uploader.destroy(u.account.picture.public_id); 
                
                let objPic = {};
                const res_cloudi = await cloudinary.v2.uploader.upload(req.files.picture.path); //document picture de type Object dans notre modèle User
                objPic.public_id = res_cloudi.public_id;
                objPic.secure_url = res_cloudi.secure_url;

                await User.findByIdAndUpdate(req.user.id, { "account.picture": objPic });
                const userUpdated = await User.findById(req.params.id); //mise à jour
                return res.status(200).json({ id: userUpdated.id, email: userUpdated.email, account: userUpdated.account, rooms: userUpdated.rooms });

              } else return res.status(401).json({ error: "User unauthorized" });
            } else return res.status(404).json({ error: "User not found" });
          } else return res.status(400).json({ error: "Wrong id" });
        } else return res.status(401).json({ error: "User unauthorized" });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    } else return res.status(400).json({ error: "Missing file" });
  } else return res.status(400).json({ error: "Missing id" });
});


//delete sa photo personnelle
router.delete("/user/delete_picture/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    try {
      if (req.user) {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
          const u = await User.findById(req.params.id);
          if (u) {
            if (u.token === req.user.token) {

              if (u.account.picture) {

                await cloudinary.uploader.destroy(u.account.picture.public_id); 
                await User.findByIdAndUpdate(req.user.id, { "account.picture": null });
                const userUpdated = await User.findById(req.params.id); //mise à jour
                return res.status(200).json({ id: userUpdated.id, email: userUpdated.email, account: userUpdated.account, rooms: userUpdated.rooms });
                
              } else return res.status(404).json({ error: "Picture not found" });
            } else return res.status(401).json({ error: "User unauthorized" });
          } else return res.status(404).json({ error: "User not found" });
        } else return res.status(400).json({ error: "Wrong id" });
      } else return res.status(401).json({ error: "User unauthorized" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


//delete un user
router.delete("/user/delete/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    try {
      if (req.user) {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
          const u = await User.findById(req.params.id);
          if (u) {
            if (u.token === req.user.token) {

              const r = await Room.find({ user: req.params.id });
              for (let i = 0; i < r.length; i++) {
                await Room.findByIdAndRemove(r[i].id);
              }
              await User.findByIdAndRemove(req.params.id);
              res.status(200).json({ message: "User deleted" });
              
            } else return res.status(401).json({ error: "User unauthorized" });
          } else return res.status(404).json({ error: "User not found" });
        } else return res.status(400).json({ error: "Wrong id" });
      } else return res.status(401).json({ error: "User unauthorized" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


module.exports = router;