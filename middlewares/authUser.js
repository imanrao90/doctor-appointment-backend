import jwt from 'jsonwebtoken'

async function authUser(req, res, next) {
  try {
    const { token } = req.headers
    if (!token) {
      return res.json({ success: false, message: "Not Authorized login again" })
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.userId = decoded.id

    next()
  } catch (error) {
    console.log(' Auth error', error)
    res.json({ success: false, message: error.message || 'Error occured' })
  }
}

export default authUser
