const express = require("express");
const cors = require("cors");
const formidable = require("express-formidable");
const compression = require("compression");
const helmet = require("helmet");
const mongoose = require("mongoose");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(formidable());
app.use(compression());
app.use(helmet());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
});

const userRoutes = require("./routes/user-route");
app.use(userRoutes);

const roomRoutes = require("./routes/room-route");
app.use(roomRoutes);

app.all("*", function (req, res) {
  res.status(404).json({ error: "Page not found" });
});

app.listen(process.env.PORT, () => {
  console.log("Server started");
});