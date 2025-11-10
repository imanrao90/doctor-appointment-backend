import validator from "validator";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import appointmentModel from "../models/appointmentModel.js";
import userModel from "../models/userModel.js";

// API for adding doctor
// API for adding doctor
async function addDoctor(req, res) {
  console.log("REQ BODY:", req.body);
  console.log("REQ FILE:", req.file);

  try {
    const { name, email, password, speciality, degree, experience, about, fees } = req.body;
    let { address } = req.body;

    // check required fields
    if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees || !address) {
      return res.status(400).json({ success: false, message: "Missing Details" });
    }

    // validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email" });
    }

    // validate password
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Please enter a strong password (min 8 chars)" });
    }

    // check duplicate doctor email
    const existing = await doctorModel.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "Doctor with this email already exists" });
    }

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // parse address
    let addressObj;
    if (typeof address === "string") {
      try {
        addressObj = JSON.parse(address);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Invalid address format (must be JSON string)" });
      }
    }

    // upload image
    const imageFile = req.file;
    if (!imageFile) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
      resource_type: "image",
      folder: "clinic_doctors",
    });
    const imageUrl = imageUpload.secure_url;

    // cleanup temp file
    try {
      await fs.unlink(imageFile.path);
    } catch (e) {
      console.warn("Failed to delete temp upload file:", e.message);
    }

    // prepare doctor data
    const doctorData = {
      name,
      email,
      image: imageUrl,
      password: hashedPassword,
      speciality,
      degree,
      experience,
      about,
      fees,
      address: addressObj,
      date: Date.now(),
    };

    console.log("FINAL DOCTOR DATA:", doctorData);

    // save doctor to MongoDB
    try {
      const newDoctor = new doctorModel(doctorData);
      await newDoctor.save();
      console.log("✅ Doctor saved in DB");
      return res.status(201).json({ success: true, message: "Doctor Added" });
    } catch (err) {
      console.error("❌ Error saving doctor:", err);
      return res.status(500).json({ success: false, message: "DB Save Error: " + err.message });
    }

  } catch (error) {
    console.error("addDoctor error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}


// API for admin login
async function loginAdmin(req, res) {
  try {
    console.log("RAW BODY:", req.body);
    console.log("HEADERS:", req.headers["content-type"]);

    const { email, password } = req.body;

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(email + password, process.env.JWT_SECRET);
      res.json({ success: true, token })
    } else {
      res.json({ success: false, message: "Invalid credentials" })
    }
  } catch (error) {
    console.error("loginAdmin error:", error);
    res.json({ success: false, message: error.message })
  }
}

// API to get all doctors list for admin panel

async function allDoctors(req, res) {
  try {
    const doctors = await doctorModel.find({}).select('-password')
    res.json({ success: true, doctors })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// API to get all appointments list

async function appointmentsAdmin(req, res) {
  try {
    const appointments = await appointmentModel.find({})
    res.json({ success: true, appointments })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// Api for appointment cancellation

async function appointmentCancel(req, res) {
  try {
    const { appointmentId } = req.body

    const appointmentData = await appointmentModel.findById(appointmentId)

    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

    // Releasing doctor slot
    const { docId, slotDate, slotTime } = appointmentData
    const doctorData = await doctorModel.findById(docId)

    let slots_booked = doctorData.slots_booked

    slots_booked[slotDate] = slots_booked[slotDate].filter((e) => e !== slotTime)

    await doctorModel.findByIdAndUpdate(docId, { slots_booked })

    res.json({ success: true, message: 'Appointment Cancelled' })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// Api to get dashboard data for admin panel

async function adminDashboard(req, res) {
  try {

    const doctors = await doctorModel.find({})
    const users = await userModel.find({})
    const appointments = await appointmentModel.find({})

    const dashData = {
      doctors: doctors.length,
      appointments: appointments.length,
      patients: users.length,
      latestAppointments: appointments.reverse().slice(0, 5)
    }

    res.json({ success: true, dashData })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

export { addDoctor, loginAdmin, allDoctors, appointmentsAdmin, appointmentCancel, adminDashboard };
