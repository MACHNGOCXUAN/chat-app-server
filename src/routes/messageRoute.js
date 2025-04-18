import express from 'express'
import { messageController } from '../controllers/messageController.js'
import authHandler from '../middleware/authHandler.js';
const router = express.Router()

router.get("/:conversationId", messageController.getMessageConversation);
router.get('/filter/:conversationId', authHandler, messageController.getFilterMessageConversation);
router.post('/delete-local/:messageId', authHandler, messageController.deleteMessageLocally);


export default router