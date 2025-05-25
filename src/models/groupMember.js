import mongoose from "mongoose"

const groupMemberSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  role: {
    type: String,
    enum: ["admin", "member"],
    default: "member"
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
}, {
  timestamps: true
})

const groupMemberModel = mongoose.model("GroupMember", groupMemberSchema)
export default groupMemberModel