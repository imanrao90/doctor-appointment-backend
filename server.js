import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import adminRouter from './routers/adminRoute.js'
import doctorRouter from './routers/doctorRoute.js'
import userRouter from './routers/userRoute.js'

const app = express()
const port = process.env.PORT || 4000

// Debug middleware
app.use((req, res, next) => {
  console.log("REQUEST HEADERS:", req.headers["content-type"]);
  next();
});

// Middlewares
app.use(cors())
app.use(express.json())

// Api endpoints
app.use('/api/admin', adminRouter)
app.use('/api/doctor', doctorRouter)
app.use('/api/user', userRouter)

// Default route
app.get('/', (req, res) => {
  res.send('API WORKING')
})

// Error handling
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// ✅ Proper DB + Cloudinary connect + server start
async function startServer() {
  try {
    await connectDB()                 // Wait for MongoDB connection
    connectCloudinary()               // Connect cloudinary
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`)
    })
  } catch (err) {
    console.error("❌ Failed to start server:", err)
    process.exit(1)
  }
}

startServer()
