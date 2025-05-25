import express from 'express'
import { messageController } from '../controllers/messageController.js'
import authHandler from '../middleware/authHandler.js';
import upload from '../middleware/upload.js';
import verifyToken from '../middleware/verifyMiddleware.js';
const router = express.Router()

router.get("/:conversationId", messageController.getMessageConversation);
router.get('/filter/:conversationId', authHandler, messageController.getFilterMessageConversation);
router.post('/delete-local/:messageId', authHandler, messageController.deleteMessageLocally);

router.get("/:conversationId", messageController.getMessageConversation)
router.post("/uploadimage",upload, messageController.uploadImage)
router.post("/uploadNhieuFile", upload, messageController.uploadNhieuFile)
router.delete("/deleteMessage/:messageId", verifyToken, messageController.deleteMessageForUser)


export default router