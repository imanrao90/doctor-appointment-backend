import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import doctorModel from '../models/doctorModel.js'
import { v2 as cloudinary } from 'cloudinary'
import appointmentModel from '../models/appointmentModel.js'
import Razorpay from 'razorpay'

// Api to register user
async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body

    const existingUser = await userModel.findOne({ email })
    console.log(name, email, password, existingUser)

    if (existingUser) {
      return res.json({ success: false, message: "This email is already in use." })
    }

    if (!name || !email || !password) {
      res.json({ success: false, message: "Missing Details" })
    }

    // validating email format
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "enter a valid email" })
    }

    // validating strong password
    if (password.length < 8) {
      return res.json({ success: false, message: "enter a strong password" })
    }

    // hashing user password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const userData = {
      name,
      email,
      password: hashedPassword
    }

    const newUser = new userModel(userData)
    const user = await newUser.save()

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

    res.json({ success: true, token })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

async function loginUser(req, res) {
  try {
    const { email, password } = req.body
    const user = await userModel.findOne({ email })

    if (!user) {
      return res.json({ success: false, message: 'User does not exist' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    console.log(isMatch, 'CHECK ISMATCH')

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
      return res.json({ success: true, token })
    } else {
      res.json({ success: false, message: 'Invalid Credentials' })
    }

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// Api for get user profile data

async function getProfile(req, res) {

  try {
    const token = req.headers.token;
    const userId = req.userId;
    if (!token) {
      return res.json({ success: false, message: "No token provided" });
    }

    // verify token and extract user id
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userData = await userModel.findById(userId).select("-password");

    return res.json({ success: true, userData });
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }

}

// Api to update user profile

async function updateProfile(req, res) {
  try {
    const token = req.headers.token;
    const userId = req.userId;
    if (!token) {
      return res.json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { name, phone, email, address, dob, gender } = req.body;
    const imageFile = req.file;

    if (!name || !phone || !dob || !gender) {
      return res.json({ success: false, message: "Data Missing" });
    }

    await userModel.findByIdAndUpdate(userId, {
      name,
      phone,
      address: JSON.parse(address),
      dob,
      gender,
    });

    if (imageFile) {
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
      const imageUrl = imageUpload.secure_url;

      await userModel.findByIdAndUpdate(userId, { image: imageUrl });
    }

    return res.json({ success: true, message: "Profile updated" });

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// Api to book appointment

async function bookAppointment(req, res) {
  try {
    const { docId, slotDate, slotTime } = req.body
    const userId = req.userId

    const docData = await doctorModel.findById(docId)

    if (!docData.available) {
      return res.json({ success: false, message: 'Doctor not available' })
    }

    let slots_booked = docData.slots_booked

    // checking for slot availability

    if (slots_booked[slotDate]) {
      if (slots_booked[slotDate].includes(slotTime)) {
        return res.json({ success: false, message: 'Doctor not available' })
      } else {
        slots_booked[slotDate].push(slotTime)
      }
    } else {
      slots_booked[slotDate] = []
      slots_booked[slotDate].push(slotTime)
    }

    const userData = await userModel.findById(userId).select('-password')
    delete docData.slots_booked

    const appointmentData = {
      userId,
      docId,
      userData,
      docData,
      amount: docData.fees,
      slotTime,
      slotDate,
      date: Date.now()
    }

    const newAppointment = new appointmentModel(appointmentData)
    await newAppointment.save()

    // Save new slots data in docData
    await doctorModel.findByIdAndUpdate(docId, { slots_booked })
    res.json({ success: true, message: 'Appointment Booked' })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// Api to get user appointments for frontend my-appointments page

async function listAppointment(req, res) {
  try {
    const userId = req.userId
    const appointments = await appointmentModel.find({ userId })

    res.json({ success: true, appointments })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// Api to cancel appointment

async function cancelAppointment(req, res) {
  try {
    const { appointmentId } = req.body
    const userId = req.userId

    const appointmentData = await appointmentModel.findById(appointmentId)

    // Verify appointment user
    if (appointmentData.userId !== userId) {
      return res.json({ success: false, message: 'Unauthorized action' })
    }

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

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})

// Api to make payment of appointment using razorpay
async function paymentRazorpay(req, res) {
  try {
    const { appointmentId } = req.body
    console.log(appointmentId, 'ID GEt')

    const appointmentData = await appointmentModel.findById(appointmentId)

    if (!appointmentData || appointmentData.cancelled) {
      return res.status(404).json({ success: false, message: 'Appointment cancelled or not found' })
    }

    const options = {
      amount: appointmentData.amount * 100, // Razorpay requires paise
      currency: process.env.CURRENCY || "INR",
      receipt: appointmentId.toString()
    }

    const order = await razorpayInstance.orders.create(options)
    return res.json({ success: true, order })

  } catch (error) {
    console.log("Razorpay error", error)
    res.status(500).json({ success: false, message: error.message || "Payment error" })
  }
}

// Api to verify payment of razorpay
async function verifyRazorpay(req, res) {
  try {
    const { razorpay_order_id } = req.body
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

    if (orderInfo.status === 'paid') {
      await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true })
      res.json({ success: true, message: 'Payment Successful' })
    } else {
      res.json({ success: false, message: 'Payment Failed' })
    }

    console.log(orderInfo)
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}


export { registerUser, getProfile, updateProfile, loginUser, bookAppointment, listAppointment, cancelAppointment, paymentRazorpay, verifyRazorpay }