import express from 'express'
import { conversationContrller } from '../controllers/conversationController.js'
import verifyToken from '../middleware/verifyMiddleware.js'

const router = express.Router()

router.get("/conversation", verifyToken, conversationContrller.getAllConversation);

router.post("/conversation", verifyToken, conversationContrller.createConversation);
router.get("/groupJoin", verifyToken, conversationContrller.getGroupJoin)


export default router