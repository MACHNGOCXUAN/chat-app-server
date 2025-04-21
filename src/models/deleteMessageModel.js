import mongoose from 'mongoose';

const deletedMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
  },
  deletedAt: {
    type: Date,
    default: Date.now,
  }
});

export default mongoose.model('DeletedMessage', deletedMessageSchema);
