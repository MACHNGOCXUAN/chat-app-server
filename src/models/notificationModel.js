import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    enum: ["message", "request"],
    default: "request"
  },
  content: {
    type: String,
    required: trusted
  },
  seem: {
    type: Boolean,
    default: false
  },
  timeStamp: {
    type: Date,
    default: Date.now
  }
})


const notificationModel = mongoose.model("Notification", notificationSchema)
export default notificationModel