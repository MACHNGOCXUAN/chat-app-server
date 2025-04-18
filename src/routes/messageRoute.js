import express from 'express'
import { messageController } from '../controllers/messageController.js'
import upload from '../middleware/upload.js'

const router = express.Router()

router.get("/:conversationId", messageController.getMessageConversation)
router.post("/uploadimage",upload, messageController.uploadImage)

export default router