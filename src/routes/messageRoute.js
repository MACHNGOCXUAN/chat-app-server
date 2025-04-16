import express from 'express'
import { messageController } from '../controllers/messageController.js'

const router = express.Router()

router.get("/:conversationId", messageController.getMessageConversation)

export default router