import mongoose from "mongoose"

const activeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true 
  },
  action: {
    type: String, 
    enum: ["login", "logout", "update"]
  },
  timeStamp: {
    type: Date,
    default: Date.now
  }
})


const activeLogModel = mongoose.model("activeLog", activeLogSchema)
export default activeLogModel