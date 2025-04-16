import express from 'express'
import verifyToken from '../middleware/verifyMiddleware.js'
import { friendController } from '../controllers/friendController.js'

const router = express.Router()

router.post("/request", friendController.addFriend)
router.post("/accept", friendController.acceptFriend)
router.get("/friends", verifyToken, friendController.getFriendsByUser)

export default router