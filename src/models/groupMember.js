import mongoose from "mongoose"

const groupMemberSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: Conversation,
    require: true
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
})

const groupMemberModel = mongoose.model("GroupMember", groupMemberSchema)
export default groupMemberModel