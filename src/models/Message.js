import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'deleted'],
    default: 'text',
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  content: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0,
  },
  duration: {
    type: Number, // audio/video duration in seconds
    default: 0,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent',
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
}, {
  timestamps: true,
});

// Compound index for efficient conversation queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, status: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
