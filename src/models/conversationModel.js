import mongoose from "mongoose"


const groupMemberSchema = new mongoose.Schema({
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
}, {_id: false})

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
  members: {
    type: [groupMemberSchema],
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },
  lastUpdateAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    joinPermission: { // Ai cos the them thanh vien vao nhom
      type: String,
      enum: ["admin", "all"],
      default: "all"
    },
    messagePermission: {  // ai co the nhan tin trong nhom
      type: String,
      enum: ["all", "admin"],
      default: "all"
    }
  },
  imageGroup: {
    type: String,
    required: true
  }
}, {
  timestamps: true
})

const conversationModel = mongoose.model("Conversation", conversationSchema)
export default conversationModel