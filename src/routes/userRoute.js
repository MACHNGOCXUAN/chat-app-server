import express from 'express'
import { userController } from '../controllers/userController.js'
import upload from '../middleware/upload.js'
import verification from '../utils/sendEmail.js'
import verifyToken from '../middleware/verifyMiddleware.js'

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
router.put("/updatePassword", userController.updatePassword)
router.put("/updateImageCover", upload, userController.updateImageCover)
router.put("/updateProfile", userController.updateProfile)
router.put("/updateAvatar", upload, userController.updateAvatar)
router.delete("/delete/:id", userController.deleteUser)
router.get("/searchUserByPhoneNumber", userController.searchUserByPhoneNumber)

export default router