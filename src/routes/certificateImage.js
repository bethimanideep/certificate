const fs = require("fs");
const Router = require("express");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const PDFDocument = require("pdfkit");
const poppler = require("pdf-poppler");
const certificateImage = Router();
const templateData = require("../models/templateModel");
const certificateData = require("../models/certificateModel");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const batchCertificateData = require("../models/batchCertificateModel");
const { logger } = require("handlebars");
const jwt = require("jsonwebtoken")

certificateImage.post("/generate-image", async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {

      return res.status(401).send({ message: "Unauthorized" });
    }
    const { role } = jwt.verify(token, process.env.JWT_KEY);
    if (role !== "Admin") {

      return res.status(403).send({ message: "Access denied" });
    }
    const { template, fields, canvasHeight, canvasWidth } = req.body;
    console.log("ID: ", template);

    try {
      const deletedFields = await certificateData.deleteMany({
        template: template,
      });
      console.log(
        `${deletedFields.deletedCount} documents deleted from certificateData collection.`
      );
    } catch (err) {
      console.error(err);
    }
    if (!template || fields.length <= 0) {
      return res.status(401).send({ message: "please fill valid input" });
    }
    const imagePath = await templateData.findById(template);
    console.log(imagePath);
    const direction = imagePath.path;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");
    const image = await loadImage(direction);
    console.log("image: ", image);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let draw_fields = function () {
      for (let field of fields) {
        ctx.fillStyle = field.fontColor;
        ctx.font = `${field.fontWeight} ${field.fontSize}px ${field.fontFamily}`;
        let textWidth = ctx.measureText(field.text).width;
        let textHeight = field.fontSize;
        field.height = textHeight;
        if (textWidth > field.width) {
          field.width = textWidth + 60;
        }
        let centerX = field.x + field.width / 2;
        let centerY = field.y + field.height / 2;
        // let centerY = field.y + field.height / 2 + window.scrollY;
        ctx.textBaseline = "middle";
        if (field.alignment === "center") {
          ctx.textAlign = "center";
          ctx.fillText(field.text, centerX, centerY - 1);
        } else if (field.alignment === "left") {
          ctx.textAlign = "left";
          ctx.fillText(field.text, field.x, centerY - 1);
        } else if (field.alignment === "right") {
          ctx.textAlign = "right";
          let textX = field.x + field.width;
          let textY = field.y + field.height / 2;
          ctx.fillText(field.text, textX, textY - 1);
          ctx.fillStyle = "transparent";
          ctx.fillRect(field.x, field.y, field.width, field.height);
        }
      }
    };
    draw_fields();

    const imageData = canvas.toBuffer(imagePath.contentType);
    const timeStamp = Math.floor(Math.random() * 10000);
    const certificataName = imagePath.name;
    const type = imagePath.contentType.split("/")[1];
    const fileName = `${timeStamp}${certificataName}.${type}`;
    console.log("fileName", fileName)
    const filePath = `uploads/certificate/${fileName}`;
    console.log(filePath)
    fs.writeFileSync(filePath, imageData);
    const saveCertificateData = await certificateData.create({
      template,
      fields,
      canvasHeight,
      canvasWidth,
      path: filePath,
      contentType: imagePath.contentType,
    });
    saveCertificateData.save();
    const responseObj = {
      imagePath: filePath,
      id: saveCertificateData._id.toString(),
    };
    res.write(JSON.stringify(responseObj));
    res.end();
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error generating image");
  }
});

certificateImage.get('/certificateimage/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const certificate = await certificateData.findOne({ template: id })

    if (!certificate) {
      return res.status(404).send({ message: "Image not found" });
    }
    fs.readFile(certificate.path, (err, data) => {
      if (err) {
        console.error(err);
        logger.error("error occured", { err })
        return res.status(500).send("Error reading image from disk");
      }

      res.writeHead(200, {
        "Content-Type": certificate.contentType,
        "Content-Disposition": `inline; filename="${certificate.name}"`,
      });
      res.end(data);
    });
  } catch (error) {
    logger.error("error occured", { error });
    return res.status(500).send({ message: "Error fetching images from database", error });
  }

})

certificateImage.get("/certificatedetails/:id", async (req, res) => {
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
    const batchCertificates = await batchCertificateData
      .find({ template: id })
      .populate("template");

    res.status(201).send(batchCertificates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong." });
  }
});

certificateImage.post("/samplecsv/:id", async (req, res) => {
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
    const certificateFields = await certificateData.findOne({ template: id });
    console.log(certificateFields);
    const fieldsArray = certificateFields.fields;
    const fields = [
      { id: "Email", title: "Email" },
      { id: "Email_subject", title: "Email_subject" },
      { id: "Email_body", title: "Email_body" },
    ];
    const data = [
      {
        Email: "pratik.ganjale59@gmail.com",
        Email_subject: "course completion certificate",
        Email_body:
          "This is informed you that you have succefully completed the course of full stack web dev",
      },
    ];
    for (let field of fieldsArray) {
      fields.push({ id: field.name, title: field.name });
    }
    for (let field of fieldsArray) {
      data[0][field.name] = field.text;
    }
    const csvWriter = createCsvWriter({
      path: "uploads/csv/output.csv",
      header: fields,
    });
    csvWriter
      .writeRecords(data)
      .then(() => {
        console.log("CSV file created successfully");
        const csvFilePath = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          "csv",
          "output.csv"
        );
        res.setHeader("Content-disposition", "attachment; filename=output.csv");
        res.set("Content-Type", "text/csv");
        const readStream = fs.createReadStream(csvFilePath);
        readStream.pipe(res);
        readStream.on("error", (err) => {
          console.log(err);
          return res.status(500).send(err);
        });
        readStream.on("close", () => {
          //fs.unlinkSync(csvFilePath);
          console.log("CSV file deleted successfully");
        });
      })
      .catch((error) => {
        console.log(error);
        return res.status(500).send(error);
      });
  } catch (error) {
    logger.error(error)
    return res.status(404).send({ message: "error while downloading csv file", error })
  }

});

certificateImage.post("/alldetails/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const certificateDetails = await certificateData
      .find({ template: id })
      .populate("template");
    if (certificateDetails.length <= 0) {
      return res.status(401).send({ message: "Data not available" });
    }
    return res
      .status(201)
      .send({ message: "data as per template id", certificateDetails });
  } catch (error) {
    logger.error("error occured", { error });
    return res.status(500).send("Error adding data to the certificate", error);
  }
});

module.exports = certificateImage;