import jwt from 'jsonwebtoken'

async function authDoctor(req, res, next) {
  try {
    const { dtoken } = req.headers
    if (!dtoken) {
      return res.json({ success: false, message: "Not Authorized login again" })
    }
    const decoded = jwt.verify(dtoken, process.env.JWT_SECRET)

    req.docId = decoded.id

    next()
  } catch (error) {
    console.log(' Auth error', error)
    res.json({ success: false, message: error.message || 'Error occured' })
  }
}

export default authDoctor