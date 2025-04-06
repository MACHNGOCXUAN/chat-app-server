import express from 'express'
import { userController } from '../controllers/userController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.post("/register",upload, userController.register)
router.post("/login", userController.login)
router.post("/logout", userController.logout)
router.post("/refresh", userController.refreshToken)

export default userRoute = router