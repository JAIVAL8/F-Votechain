const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");
const crypto = require("crypto");
// const SHA256 = require("crypto-js/sha256");
const User = mongoose.model("User");
const jwt = require("jsonwebtoken");
const {
  SECRET_KEY,
  JWT_SECRET,
  EMAIL,
  EMAIL_PASS,
  HOST,
} = require("../config/keys");
const requireLogin = require("../middleware/requireLogin");
const nodemailer = require("nodemailer");

function encrypt(text, secret) {
  let ciphertext = CryptoJS.AES.encrypt(text, secret).toString();
  return ciphertext;
}

function decrypt(ciphertext, secret) {
  let bytes = CryptoJS.AES.decrypt(ciphertext, secret);
  let originalText = bytes.toString(CryptoJS.enc.Utf8);
  return originalText;
}

router.post("/signup", (req, res) => {
  // console.log(req.body);
  const {
    aadharNo,
    email,
    phone,
    gender,
    age,
    city,
    password,
    confirmpass,
  } = req.body;

  const txt = aadharNo + password;
  // console.log(uid);
  const uid = CryptoJS.SHA256(txt).toString();
  //console.log(hash);

  User.findOne({ uId: uid })
    .then((savedUser) => {
      if (savedUser) {
        return res.status(422).json({ error: "User already exists" });
      }
      const encryptedPhone = encrypt(phone.toString(), password);
      const encryptedGender = encrypt(gender, SECRET_KEY);
      const encryptedAge = encrypt(age.toString(), SECRET_KEY);
      const encryptedCity = encrypt(city, SECRET_KEY);
      const encryptedEmail = encrypt(email, SECRET_KEY);
      const encryptedAadhar = encrypt(aadharNo, SECRET_KEY);

      const user = new User({
        uId: uid,
        email: encryptedEmail,
        phoneNo: encryptedPhone,
        gender: encryptedGender,
        age: encryptedAge,
        city: encryptedCity,
        aadhar: encryptedAadhar,
      });

      user
        .save()
        .then((user) => {
          let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
              user: EMAIL,
              pass: EMAIL_PASS,
            },
          });
          transporter.sendMail(
            {
              from: EMAIL,
              to: email, // list of receivers
              subject: "VOTECHAIN [Registered Successfully]", // Subject line
              html:
                "<h3>You have successfully registered on VoteChain</h3>" +
                "<br><h3>Save this Unique_ID (uId)</h3>" +
                '<b>"' +
                user.uId +
                '"</b>' +
                "<br><p> If in case you forgot your password use this (uId) for resetting the password.</p>",
            },
            (error, response) => {
              if (error) {
                console.log(error);
              } else {
                // console.log(response);
              }
            }
          );
          res.json({ message: "Signed In Successfully" });
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
});

router.post("/signin", (req, res) => {
  const { aadharNo, password } = req.body;

  const txt = aadharNo + password;
  // console.log(txt);
  const uid = CryptoJS.SHA256(txt).toString();
  //console.log(uid);

  User.findOne({ uId: uid }).then((savedUser) => {
    if (!savedUser) {
      return res
        .status(422)
        .json({ error: "Invalid *Aadhar No* or *Password*" });
    }

    const decryptedPhoneNo = decrypt(savedUser.phoneNo, password);
    const token = jwt.sign({ _id: savedUser._id }, JWT_SECRET);
    const { _id, uId, gender, age, city } = savedUser;

    res.json({
      mobileNo: decryptedPhoneNo,
      user: { _id, uId, gender, age, city },
      token,
    });
    // res.json({ message: "signed in successfully" });
    //console.log(savedUser);
  });
});

router.post("/reset-password", (req, res) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
    }
    const { uId } = req.body;
    const token = buffer.toString("hex");
    User.findOne({ uId: uId }).then((user) => {
      if (!user) {
        return res.status(422).json({ err: "*Unique Id* does not match!" });
      }

      const decryptedEmail = decrypt(user.email, SECRET_KEY);
      const link = HOST + "/reset-password/" + token;
      // console.log(token);
      // console.log(typeof token);
      user.resetToken = token;
      user.expireToken = Date.now() + 3600000;
      // user.save().then((result) => {
      let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: EMAIL,
          pass: EMAIL_PASS,
        },
      });
      transporter.sendMail(
        {
          from: EMAIL,
          to: decryptedEmail, // list of receivers
          subject: "VOTECHAIN [Password Reset]", // Subject line
          html:
            "<h3>You have requested to reset your password</h3>" +
            "<br><h3>Click on this link to reset <a href='" +
            link +
            "'>password!</a></h3>" +
            "<br><p>This link is valid only for 60 minutes!!</p>",
        },
        (err, res) => {
          if (err) {
            console.log(err);
          } else {
            //console.log(res);
          }
        }
      );
      user.save();
      res.json({
        message: "Check your Email",
      });
      //});
    });
  });
});

router.post("/new-password", (req, res) => {
  const newPassword = req.body.password;
  const sentToken = req.body.token;
  User.findOne({ resetToken: sentToken, expireToken: { $gt: Date.now() } })
    .then((user) => {
      if (!user) {
        return res.status(422).json({ err: "Try again session expired" });
      }

      const decryptedAadhar = decrypt(user.aadhar, SECRET_KEY);
      //console.log(decryptedAadhar);
      const txt = decryptedAadhar + newPassword;
      // console.log(uid);
      const uid = CryptoJS.SHA256(txt).toString();

      const decryptedEmail = decrypt(user.email, SECRET_KEY);

      user.uId = uid;
      user.resetToken = undefined;
      user.expireToken = undefined;
      user
        .save()
        .then((savedUser) => {
          let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
              user: EMAIL,
              pass: EMAIL_PASS,
            },
          });
          transporter.sendMail(
            {
              from: EMAIL,
              to: decryptedEmail, // list of receivers
              subject: "VOTECHAIN [Credentials Changed Successfully]", // Subject line
              html:
                "<h3>You have successfully changed your password on VoteChain</h3>" +
                "<br><h3>Save this Unique_ID (uId)</h3>" +
                '<b>"' +
                savedUser.uId +
                '"</b>' +
                "<br><p> If in case you forgot your password use this (uId) for resetting the password.</p>",
            },
            (error, response) => {
              if (error) {
                console.log(error);
              } else {
                //console.log(response);
              }
            }
          );
          //console.log(savedUser);
          res.json({ message: "password updated success" });
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
});

module.exports = router;