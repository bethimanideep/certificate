const Router = require("express");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const createTemplate = Router();
const logger = require("./logger");
const imageData = require("../models/templateModel");
const jwt = require("jsonwebtoken");
const sizeOf = require('image-size');

// multer //
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/templates");
  },
  filename: function (req, file, cb) {
    const timeStamp = new Date().toISOString().replace(/:/g, "-");
    cb(null, `${timeStamp}_${file.originalname}`);
  },
});
const fileFilter = function (req, file, cb) {
  if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
    return cb(new Error("Only image files jpg,jpeg,png are allowed!"));
  }
  cb(null, true);
};
const upload = multer({ storage: storage, fileFilter: fileFilter });

// upload template //
createTemplate.post("/uploadtemplate", upload.single("image"), (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {

      return res.status(401).send({ message: "Unauthorized" });
    }
    const { role } = jwt.verify(token, process.env.JWT_KEY);
    if (role !== "Admin") {

      return res.status(403).send({ message: "Access denied" });
    }
    const { name } = req.body;

    const dimensions = sizeOf(req.file.path);
    let height = dimensions.height;
    let width = dimensions.width;
    const aspectRatio = dimensions.width / dimensions.height;
    const image = new imageData({
      name: name,
      path: path
        .join("uploads/templates", req.file.filename)
        .replace(/\\/g, "/"),
      contentType: req.file.mimetype,
      height: height,
      width: width
    });
    image.save();
    logger.info("file saved successfully");
    return res.status(200).send({ message: "File uploaded and saved to database successfully!", aspectRatio, height, width });
  } catch (error) {
    logger.error("error occured", { error });
    return res.status(500).send("Error saving image to database", error);
  }
});

createTemplate.get("/alltemplates", async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {

      return res.status(401).send({ message: "Unauthorized" });
    }
    const { role } = jwt.verify(token, process.env.JWT_KEY);
    if (role !== "Admin") {

      return res.status(403).send({ message: "Access denied" });
    }
    const images = await imageData.find({});
    if (!images || images.length <= 0) {
      return res.status(404).send({ message: "Images not found" });
    }
    // console.log(images)
    const array = images.map((image) => {
      return new Promise((resolve, reject) => {
        const filePath = image.path;
        fs.readFile(filePath, (err, data) => {
          if (err) {
            console.error(err);
            logger.error("error occured", { err });
            return reject(`Error reading image from disk: ${image.name}`);
          }

          resolve({
            id: image._id,
            name: image.name,
            path: filePath,
            contentType: image.contentType,
            height: image.height,
            width: image.width
          });
        });
      });
    });
    const imageDataArray = await Promise.all(array);
    res.send(imageDataArray);
  } catch (error) {
    console.log(error);
    logger.error("error occured", { error });
    return res.status(500).send({ message: "Error fetching images from database", error });
  }
});

createTemplate.get("/singletemplate/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const image = await imageData.findById(id).lean().exec();

    if (!image || image.length <= 0) {
      return res.status(404).send({ message: "Image not found" });
    }

    fs.readFile(image.path, (err, data) => {
      if (err) {
        console.error(err);
        logger.error("error occured", { err })
        return res.status(500).send("Error reading image from disk");
      }

      res.writeHead(200, {
        "Content-Type": image.contentType,
        "Content-Disposition": `inline; filename="${image.name}"`,
      });
      console.log(data,"temp")
      res.end(data);
    });
  } catch (error) {
    logger.error("error occured", { error });
    return res.status(500).send({ message: "Error fetching images from database", error });
  }
});

createTemplate.patch("/updatetemplate/:id", async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {

      return res.status(401).send({ message: "Unauthorized" });
    }
    const { role } = jwt.verify(token, process.env.JWT_KEY);
    if (role !== "Admin") {

      return res.status(403).send({ message: "Access denied" });
    }
    const { id } = req.params;
    const { name } = req.body;

    const existingImage = await imageData.findOne({ name });
    if (existingImage) {
      return res.status(400).send({ message: "Image name already exists" });
    }

    const image = await imageData.findById(id);

    if (!image) {
      return res.status(404).send({ message: "Image not found" });
    }

    var contentType = image.contentType.split("/")[1];
    // console.log(contentType);
    const oldPath = image.path;
    const newPath = path.join("uploads/templates", `${name}.${contentType}`);
    // Rename the file
    fs.rename(oldPath, newPath, async (err) => {
      if (err) {
        console.error(err);
        logger.error("error occured", { err });
        return res.status(500).send("Error renaming image file");
      }

      // Update the image object with the new file name and path
      image.name = name;
      image.path = newPath;

      await image.save();

      logger.info("image updated successfully");

      return res.send({ message: "Image updated successfully" });
    });
  } catch (error) {
    logger.error("error occured", { error });
    return res.status(500).send({ message: "error getting while edit name", error });
  }
});

//delete template//
createTemplate.delete("/deletetemplate/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const image = await imageData.findById(id);

    if (!image) {
      return res.status(404).send({ message: "Image not found" });
    }
    const filePath = image.path;
    await imageData.findByIdAndDelete(id);
    logger.info("image deleted successfully");
    console.log("image deleted successfully");

    fs.unlink(filePath, async (err) => {
      if (err) {
        console.error(err);
        logger.error("error occured", { err });

        // Restore the deleted file
        const restoredImage = new imageData({
          name: image.name,
          path: path.join("uploads/templates", image.name).replace(/\\/g, "/"),
          contentType: image.contentType,
        });
        await restoredImage.save();

        return res
          .status(500)
          .send("Error deleting image from disk. File has been restored.");
      }

      return res.send({ message: "Image deleted successfully" });
    });
  } catch (error) {
    logger.error("error occured", { error });
    return res.status(500).send({ message: "error getting while delete template" });

  }
});

module.exports = createTemplate;
