import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation"
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  messageType: {
    type: String,
    enum: ["text", "image", "video", "audio", "file"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  edited: {
    type: Boolean,
    default: false,
  },
  is_last_message: {
    type: Boolean,
    default: false,
  },
  next_message: {
    type: String,
  },
  preMessage: {
    type: String
  }
}, {
  timestamps: true
})


const messageModel = mongoose.model("Message", messageSchema)
export default messageModel