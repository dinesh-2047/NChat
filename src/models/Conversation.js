import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  // Track typing status per user
  typingUsers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  }],
  // Track cleared chat status per user
  clearedAt: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date },
  }],
  // Track hidden/deleted conversation status per user
  hiddenFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

// Helper to generate consistent conversation ID from two user IDs
ConversationSchema.statics.getConversationId = function(userId1, userId2) {
  return [userId1.toString(), userId2.toString()].sort().join('_');
};

export default mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
