const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Room = require("../models/room-model");
const User = require("../models/user-model");
const isAuthenticated = require("../middlewares/isAuthenticated");

const cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


//create room
router.post("/room/publish", isAuthenticated, async (req, res) => {
  try {
    if (req.user) {
      if (req.fields.title && req.fields.description && req.fields.price && req.fields.location) {
        if (req.fields.title.trim().length > 0 && req.fields.description.trim().length > 0 && req.fields.price > 0) { 

          const newRoom = new Room({
            title: req.fields.title,
            description: req.fields.description,
            price: req.fields.price,
            location: [req.fields.location.lat, req.fields.location.lng],
            user: req.user,
          });

          await newRoom.save();

          const u = await User.findById(req.user.id);
          u.rooms.push(newRoom.id);
          await User.findByIdAndUpdate(req.user.id, { rooms: u.rooms });
          res.json({ id: newRoom.id, title: newRoom.title, description: newRoom.description, price: newRoom.price, email: newRoom.user.email, account: newRoom.user.account });

        } else return res.status(400).json({ error: "All fields must be completed correctly" });
      } else return res.status(400).json({ error: "Missing parameters" });
    } else return res.status(400).json({ error: "User unauthorized" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});


//filtrer les rooms
router.get("/rooms", async (req, res) => {
  const queryTab = Object.keys(req.query);
  try {
    if (queryTab.length > 0) { //s'il y a au moins un filtre

      const f = {}; //objet filtres
      if (req.query.title) {
        f.title = new RegExp(req.query.title, "i"); //ignorer la casse
      }
      if ((req.query.priceMin && !isNaN(req.query.priceMin)) || (req.query.priceMax && !isNaN(req.query.priceMax))) {
        f.price = {};
        if (req.query.priceMin) f.price.$gte = req.query.priceMin; //au dessus de min
        if (req.query.priceMax) f.price.$lte = req.query.priceMax; //au dessous de max
      }

      const s = {}; //objet tri
      if (req.query.sort) {
        if (req.query.sort === "price-desc") s.price = -1;
        else if (req.query.sort === "price-asc") s.price = 1;
        else if (req.query.sort === "date-desc") s.created = -1;
        else if (req.query.sort === "date-asc") s.created = 1;
      }

      let r = await Room.find(f).sort(s).populate({ path: "user", select: "account" }); //ajout des objets filtres/tri
      const size_r = r.length;

      if (req.query.page) {
        if (!isNaN(req.query.page)) {
          const l = 5; //on choisit de limiter 5 annonces par page
          const nb_pages = Math.ceil(size_r / l); //arrondir au supérieur

          if (req.query.page > 0 && req.query.page <= nb_pages) {
            r = await Room.find(f).sort(s).limit(l).skip(l * req.query.page - l).populate({ path: "user", select: "account" });
          }
        }
      }

      return res.status(200).json(r);

    } else { //pas de filtre

      const r = await Room.find();
      if (r.length > 15) {
        let randomRooms = [];
        let randomNumber;
        //sélectionne 15 éléments de manière aléatoire
        let i = 0;
        while (i < 15){
          randomNumber = Math.floor(Math.random() * r.length);
          if (randomRooms.indexOf(r[randomNumber]) === -1){
            randomRooms.push(r[randomNumber]);
            i++;
          }
        }
        return res.status(200).json(randomRooms);

      } else {
        return res.status(200).json(r);
      }
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});


//rooms proche de l'user
router.get("/rooms/around", async (req, res) => {
  if (req.query.latitude && req.query.longitude) {
    try {
      if (!isNaN(req.query.latitude) && req.query.latitude > 0 && !isNaN(req.query.longitude) && req.query.longitude > 0) {

        const r = await Room.find({ location: { $near: [req.query.latitude, req.query.longitude], $maxDistance: 0.1 } });
        return res.status(200).json(r);

      } else return res.status(400).json({ error: "Wrong latitude/longitude" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing location" });
});


//room identifié par son id (params)
router.get("/room/:id", async (req, res) => {
  if (req.params.id){
    try {
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        const r = await Room.findById(req.params.id).populate({ path: "user", select: "account" });
        if (r) {

          return res.status(200).json(r);
            
        } else return res.status(404).json({ error: "Room not found" });
      } else return res.status(400).json({ error: "Wrong id" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


//update room - title, description, price, location
router.put("/room/update/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    try {
      if (req.user) {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
          const r = await Room.findById(req.params.id).populate({ path: "user", select: "token" });
          if (r) {
            if (r.user.token === req.user.token) {
              if(req.fields.title || req.fields.description || req.fields.price || req.fields.location) {
                let newObj = {};

                if (req.fields.title && req.fields.title.trim().length > 0) {
                  newObj.title = req.fields.title;
                }
                if (req.fields.description && req.fields.description.trim().length > 0) {
                  newObj.description = req.fields.description;
                }
                if (req.fields.price && req.fields.price > 0) {
                  newObj.price = req.fields.price;
                }
                if (req.fields.location && req.fields.location.length === 2) {
                  if (req.fields.location.filter(x => !isNaN(x)).length === 2) {
                    //newObj.location = [req.fields.location.lat, req.fields.location.lng];
                    newObj.location = req.fields.location;
                  } else return res.status(400).json({ error: "Wrong parameters lat/lng" });
                }

                await Room.findByIdAndUpdate(req.params.id, newObj);
                const roomUpdated = await Room.findById(req.params.id); //mise à jour
                return res.status(200).json(roomUpdated);

              } else return res.status(400).json({ error: "Missing parameters" });
            } else return res.status(401).json({ error: "User unauthorized" });
          } else return res.status(404).json({ error: "Room not found" });
        } else return res.status(400).json({ error: "Wrong id" });
      } else return res.status(401).json({ error: "User unauthorized" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else return res.status(400).json({ error: "Missing id" });
});


//update une photo - room (5 photos max)
router.put("/room/upload_picture/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    if (req.files.pictures) {
      try {
        if (req.user) {
          if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            const r = await Room.findById(req.params.id).populate({ path: "user", select: "token" });
            if (r) {
              if (r.user.token === req.user.token) {
                if(r.pictures.length < 5){

                  let objPic = {};
                  const res_cloudi = await cloudinary.v2.uploader.upload(req.files.pictures.path); //document pictures de type [Object]
                  objPic.public_id = res_cloudi.public_id;
                  objPic.secure_url = res_cloudi.secure_url;
                  r.pictures.push(objPic); //ajout de la photo au tableau pictures

                  r.save();
                  const roomUpdated = await Room.findById(req.params.id); //mise à jour
                  return res.status(200).json(roomUpdated);

                } else return res.status(400).json({ error: "Can't add more 5 pictures" });
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


//delete une photo, id room query, id picture body
router.delete("/room/delete_picture/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
    if (req.fields.picture_id) {
      try {
        if (req.user) {
          if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            const r = await Room.findById(req.params.id).populate({ path: "user", select: "token" });
            if (r) {
              if (r.user.token === req.user.token) {

                let j = 0;
                for (let i = 0; i < r.pictures.length; i++) {
                  if (req.fields.picture_id === r.pictures[i].public_id) j++;
                }
                if (j === 1) {

                  for (let i = 0; i < r.pictures.length; i++) {
                    if (req.fields.picture_id === r.pictures[i].public_id) {
                      const num = r.pictures.indexOf(r.pictures[i]);
                      r.pictures.splice(num, 1);   
                      await cloudinary.uploader.destroy(req.fields.picture_id); 
                      break;
                    }
                  }

                  r.save();
                  return res.status(200).json(r);

                } else return res.status(404).json({ error: "Picture not found" });
              } else return res.status(401).json({ error: "User unauthorized" });
            } else return res.status(404).json({ error: "Room not found" });
          } else return res.status(400).json({ error: "Wrong id" });
        } else return res.status(401).json({ error: "User unauthorized" });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    } else return res.status(400).json({ error: "Missing public_id (file)" });
  } else return res.status(400).json({ error: "Missing id" });
});


//delete une room, id room query
router.delete("/room/delete/:id", isAuthenticated, async (req, res) => {
  if (req.params.id){
      try {
        if (req.user) {
          if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            const r = await Room.findById(req.params.id).populate({ path: "user", select: "id token" });
            if (r) {
              if (r.user.token === req.user.token) {

                for (let i = 0; i < r.pictures.length; i++) {
                  await cloudinary.uploader.destroy(r.pictures[i].public_id); //supprime les photos de la room sur cloudinary
                }

                await Room.findByIdAndRemove(req.params.id);
                const u = await User.findById(r.user.id);
                let num = u.rooms.indexOf(req.params.id);
                u.rooms.splice(num, 1);
                u.save();
                return res.status(200).json({ message: "Room deleted" });

              } else return res.status(401).json({ error: "User unauthorized" });
            } else return res.status(404).json({ error: "Room not found" });
          } else return res.status(400).json({ error: "Wrong id" });
        } else return res.status(401).json({ error: "User unauthorized" });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

  } else return res.status(400).json({ error: "Missing id" });
});


module.exports = router;