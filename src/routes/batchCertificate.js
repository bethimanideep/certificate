const dotenv = require("dotenv");
dotenv.config();
const Router = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { createCanvas, loadImage } = require("canvas");
const batchCertiRoute = Router();
const nodemailer = require("nodemailer");
const upload = multer({ dest: "uploads/csv" });
const jwt = require("jsonwebtoken");
const BatchCertificate = require("../models/batchCertificateModel");
const certificateModelData = require("../models/certificateModel");
const studentCertificates = require("../models/studentModel");
const { v4: uuidv4 } = require("uuid");
let unique;
let arr = [];

const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { template } = require("handlebars");
const batchCertificateModel = require("../models/batchCertificateModel");

// batchCertiRoute.get("/userimage",async(req,res)=>{
//   let {id,email,path}=req.query
//   let data=await 
// })

batchCertiRoute.get("/image", async (req, res) => {
  let {path}=req.query
  try {
    fs.readFile(path, (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error reading image from disk");
      }
      res.end(data);
    });
    
  } catch (error) {
    return res.status(500).send({ message: "Error fetching images from database", error });
  }

});
batchCertiRoute.post("/batch/:id", async (req, res) => {
  //uniq/
  let id = req.params.id;
  try {
    let document = await BatchCertificate.findById(id);
    if (!document) {
      res.json("not found");
      return;
    }
    res.status(200).json(document);
  } catch (error) {
    res.status(200).json("not found");
  }
});

batchCertiRoute.post(
  "/certificate/batch/:id",
  upload.single("csv"),
  async (req, res) => {
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
      const { batch } = req.body;

      unique = uuidv4();
      const csvData = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (data) => {
          csvData.push(data);
        })
        .on("end", async () => {
          const batchCertificates = {};
          batchCertificates.template = id;
          batchCertificates.batch = batch;
          batchCertificates.emailBody = csvData[0].Email_body;
          batchCertificates.emailSubject = csvData[0].Email_subject;
          batchCertificates.fields = [];
          batchCertificates.failedemails = [];
          batchCertificates.successemails = [];
          batchCertificates.unique = unique;
          for (let i = 0; i < csvData.length; i++) {
            let object = {};

            object["Name"] = csvData[i].Name;
            object["Email"] = csvData[i].Email;
            object["Email_subject"] = csvData[i].Email_subject;
            object["Email_body"] = csvData[i].Email_body;


            batchCertificates.fields.push(object);
          }
          const certificate = new BatchCertificate(batchCertificates); //batchdetails saving in batchCertificate
          await certificate.save();

          let i = 0;
          function recursion(i) {
            let obj = csvData[i];
            if (i >= csvData.length) {
              return;
            }
            sendMailToUser(obj, id, batch);
            setTimeout(() => {
              recursion(i + 1);
            }, 2000);
          }
          recursion(i);
          console.log(arr, "updatedarray1")
        });
      // await BatchCertificate.findOneAndUpdate({ unique},{Imagepath:arr});

      console.log(arr, "updatedarray2")
      res.json("GOT");
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message, status: "false" });
    }
  }
);
batchCertiRoute.get("/batchdetails", async (req, res) => {
  let doc = await BatchCertificate.findOne({ unique });
  return res.status(200).json(doc);
});


async function sendMailToUser(obj, id, batch) {
  try {
    const getData = await certificateModelData
      .findOne({ template: id })
      .populate("template");
    if (!getData || getData.length <= 0) {
      throw new Error("Certificate template not found");
    }

    const canvas = createCanvas(getData.canvasWidth, getData.canvasHeight);
    const ctx = canvas.getContext("2d");
    const direction = getData.template.path;
    if (!direction) {
      return res.status(404).send({ message: "Template not found" });
    }
    const image = await loadImage(direction);
    if (!image) {
      return res.status(500).send({ message: "Error loading template image" });
    }
    let fields = getData.fields;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let value;
    for (let field of fields) {
      if (obj.hasOwnProperty(field.name)) {
        value = obj[field.name];
      } else {
        value = field.text;
      }
      ctx.fillStyle = field.fontColor;
      ctx.font = `${field.fontWeight} ${field.fontSize}px ${field.fontFamily}`;
      let textWidth = ctx.measureText(value).width;
      let textHeight = field.fontSize;
      field.height = textHeight;
      if (textWidth > field.width) {
        field.width = textWidth + 60;
      }
      let centerX = field.x + field.width / 2;
      let centerY = field.y + field.height / 2;
      ctx.textBaseline = "middle";
      if (field.alignment === "center") {
        ctx.textAlign = "center";
        ctx.fillText(value, centerX, centerY - 1);
      } else if (field.alignment === "left") {
        ctx.textAlign = "left";
        ctx.fillText(value, field.x, centerY - 1);
      } else if (field.alignment === "right") {
        ctx.textAlign = "right";
        let textX = field.x + field.width;
        let textY = field.y + field.height / 2;
        ctx.fillText(value, textX, textY - 1);
        ctx.fillStyle = "transparent";
        ctx.fillRect(field.x, field.y, field.width, field.height);
      }
    }

    const imageData = canvas.toBuffer(getData.template.contentType); //doubt
    const timeStamp = Math.floor(Math.random() * 10000);
    const certificataName = getData.template.name;
    const type = getData.template.contentType.split("/")[1];
    const fileName = `${timeStamp}${certificataName}.${type}`;
    const filePath = `uploads/bulkcertificate/${fileName}`;

    let previousdata= await BatchCertificate.findOne({ unique });
    let dd = previousdata.Imagepath
    dd.push({ Email: obj.Email, Path: filePath })
    await BatchCertificate.findOneAndUpdate({ unique },{Imagepath:dd});



    fs.writeFileSync(filePath, imageData);

    const batchData = await studentCertificates({
      name: obj.Name,
      batch: batch,
      email: obj.Email,
      path: filePath,
      contentType: getData.template.contentType,
    });
    await batchData.save();
    return new Promise((resolve, reject) => {
      const attachment = {
        filename: `${obj.Name}.jpg`,
        content: imageData,
      };
      let mailOptions = {
        from: process.env.USER_EMAIL,
        to: obj.Email,
        subject: obj.Email_subject,
        text: obj.Email_body,
        attachments: [attachment],
      };
      let mailConfig = {
        service: "gmail",
        auth: {
          user: process.env.USER_EMAIL,
          pass: process.env.USER_PASS,
        },
      };
      nodemailer
        .createTransport(mailConfig)
        .sendMail(mailOptions, async (err, info) => {
          if (info) {
            let doc = await BatchCertificate.findOne({ unique: unique });
            doc.successemails.push(obj);
            await BatchCertificate.findOneAndUpdate(
              { unique },
              { successemails: doc.successemails }
            );
            resolve(info);
          } else {
            try {
              if (err) {
                let doc = await BatchCertificate.findOne({ unique: unique });
                doc.failedemails.push(obj);
                await BatchCertificate.findOneAndUpdate(
                  { unique },
                  { failedemails: doc.failedemails }
                );
              }
            } catch (error) {
              console.log(error, unique);
            }
          }
        });
    });
  } catch (error) {
    console.error(error);
  }
}

//downloads
batchCertiRoute.get("/allemails/:id", async (req, res) => {
  let id = req.params.id;
  let doc = await BatchCertificate.findOne({ _id: id });
  if (!doc) res.json("not found");
  const data = doc.fields;

  const csvWriter = createCsvWriter({
    path: "temporaryCSV/output.csv",
    header: [
      { id: "Email", title: "Email" },
      { id: "Email_subject", title: "Email_subject" },
      { id: "Email_body", title: "Email_body" },
      { id: "Name", title: "Name" },
    ],
  });

  csvWriter
    .writeRecords(data)
    .then(() => {
      console.log("CSV file created successfully");
      res.download("temporaryCSV/output.csv");
    })
    .catch((error) => {
      console.error("Error creating CSV file:", error);
      res.status(500).send("Error creating CSV file");
    });
});
batchCertiRoute.get("/successemails/:id", async (req, res) => {
  let id = req.params.id;
  let doc = await BatchCertificate.findOne({ _id: id });
  if (!doc) res.json("not found");
  const data = doc.successemails;

  const csvWriter = createCsvWriter({
    path: "temporaryCSV/output.csv",
    header: [
      { id: "Email", title: "Email" },
      { id: "Email_subject", title: "Email_subject" },
      { id: "Email_body", title: "Email_body" },
      { id: "Name", title: "Name" },
    ],
  });

  csvWriter
    .writeRecords(data)
    .then(() => {
      console.log("CSV file created successfully");
      res.download("temporaryCSV/output.csv");
    })
    .catch((error) => {
      console.error("Error creating CSV file:", error);
      res.status(500).send("Error creating CSV file");
    });
});

batchCertiRoute.get("/failedemails/:id", async (req, res) => {
  let id = req.params.id;
  try {
    let doc = await BatchCertificate.findOne({ _id: id });
    if (!doc) res.json("not found");
    const data = doc.failedemails;
    const csvWriter = createCsvWriter({
      path: "temporaryCSV/output.csv",
      header: [
        { id: "Email", title: "Email" },
        { id: "Email_subject", title: "Email_subject" },
        { id: "Email_body", title: "Email_body" },
        { id: "Name", title: "Name" },
      ],
    });

    csvWriter
      .writeRecords(data)
      .then(() => {
        console.log("CSV file created successfully");
        res.download("temporaryCSV/output.csv");
      })
      .catch((error) => {
        console.error("Error creating CSV file:", error);
        res.status(500).send("Error creating CSV file");
      });
  } catch (error) {
    res.json("not found");
  }
});

module.exports = batchCertiRoute;
