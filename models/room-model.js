const mongoose = require("mongoose");

const Room = mongoose.model("Room", {
  title: String,
  description: String,
  price: Number,
  ratingValue: Number,
  reviews: Number,
  pictures: Array,
  location: {
    type: [Number],
    index: "2d"
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

module.exports = Room;