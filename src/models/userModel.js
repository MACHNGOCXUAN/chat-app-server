import mongoose from "mongoose";


const friendSchema = new mongoose.Schema({
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "blocked"],
    default: "pending"
  }
}, { _id: false})

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  avatarURL: {
    type: String
  },
  status: {
    type: String,
    enum: ["active", "inactive", "banned"],
    default: "active"
  },
  lastSeen: {
    type: Date
  },
  coverImage: {
    type: String,
    default: "https://i.pinimg.com/736x/dc/e3/cb/dce3cb7b2daeb86ca5bd921ae06f3b2f.jpg"
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  friends: {
    type: [friendSchema],
    default: []
  }
}, {
  timestamps: true 
});

const userModel = mongoose.model("User", userSchema);
export default userModel;