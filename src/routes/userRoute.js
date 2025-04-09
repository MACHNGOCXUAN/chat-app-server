import express from 'express'
import { userController } from '../controllers/userController.js'
import upload from '../middleware/upload.js'
import verification from '../utils/sendEmail.js'

const router = express.Router()

router.post("/register",upload, userController.register)
router.post("/login", userController.login)
router.post("/logout", userController.logout)
router.post("/refresh", userController.refreshToken)
router.post("/verify", verification)
router.post("/checkPhoneAndEmail", userController.checkUserExists)
router.post("/checkEmail", userController.checkEmailExists)
router.get("/users", userController.getAllUser)
router.put("/forgotPasswrod", userController.forgotPassword)

export default router