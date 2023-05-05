const mongoose = require("mongoose");

const batchCertificateSchema = new mongoose.Schema({
  template : { type: mongoose.Schema.Types.ObjectId, ref: "template", required: true },
  batch:{ type: String},
  emailBody:{ type: String, required: true},
  emailSubject:{ type: String, required: true},
 
  fields:[
    {
      email:{ type: String },
      name:{ type: String }
    }
  ],
  unique: { type: String, unique: true },
  failedemails:{type:Array}
});


module.exports = mongoose.model("batchCertificate", batchCertificateSchema);

