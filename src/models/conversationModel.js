import mongoose from "mongoose"

const conversationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["private", "group"],
    default: "private"
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
  ],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },
  lastUpdateAt: {
    type: Date
  }
}, {
  timestamps: true
})

const conversationModel = mongoose.model("Conversation", conversationSchema)
export default conversationModel