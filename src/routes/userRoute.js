import express from 'express'
import { userController } from '../controllers/userController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.post("/register",upload, userController.register)

export default router