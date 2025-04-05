import mongoose from "mongoose";

const botInteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  botResponse: {
    type: String
  },
  timeStamp: {
    type: Date,
    default: Date.now,
  },
})

const botInteractionModel = mongoose.model("BotInteraction", botInteractionSchema)
export default botInteractionModel