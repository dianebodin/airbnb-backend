const mongoose = require("mongoose");

const User = mongoose.model("User", {
  email: { type: String, unique: true, required: true },
  token: String,
  hash: String,
  salt: String,
  account: {
    username: { type: String, unique: true, required: true },
    name: String,
    description: String,
    picture: Object
  },
  rooms: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room"
    }
  ]
});

module.exports = User;