import express from 'express'
import verifyToken from '../middleware/verifyMiddleware.js'
import { friendController } from '../controllers/friendController.js'

const router = express.Router()

router.post("/request",verifyToken, friendController.addFriend)
router.post("/accept", verifyToken, friendController.acceptFriend)

export default friendRoute = router