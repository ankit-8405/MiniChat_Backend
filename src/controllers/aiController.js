const Message = require('../models/Message');
const Channel = require('../models/Channel');

// Note: Install openai package: npm install openai
// Set OPENAI_API_KEY in .env

// Summarize conversation
exports.summarizeConversation = async (req, res, next) => {
  try {
    const { channelId, messageCount = 50 } = req.body;
    const userId = req.userId;

    // Check if user is channel member
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = channel.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    // Get recent messages
    const messages = await Message.find({ channelId })
      .sort({ timestamp: -1 })
      .limit(messageCount)
      .populate('sender', 'username');

    if (messages.length === 0) {
      return res.json({ summary: 'No messages to summarize.' });
    }

    // Format messages for AI
    const conversation = messages
      .reverse()
      .map(msg => `${msg.sender.username}: ${msg.text}`)
      .join('\n');

    // Mock AI response (replace with actual OpenAI call)
    const summary = await generateSummary(conversation);

    res.json({ 
      summary,
      messageCount: messages.length,
      timeRange: {
        from: messages[0].timestamp,
        to: messages[messages.length - 1].timestamp
      }
    });
  } catch (error) {
    next(error);
  }
};

// Translate message
exports.translateMessage = async (req, res, next) => {
  try {
    const { messageId, targetLanguage } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is channel member
    const channel = await Channel.findById(message.channelId);
    const isMember = channel.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    // Mock translation (replace with actual API call)
    const translation = await translateText(message.text, targetLanguage);

    res.json({
      original: message.text,
      translated: translation,
      targetLanguage
    });
  } catch (error) {
    next(error);
  }
};

// Get smart reply suggestions
exports.getSmartReplies = async (req, res, next) => {
  try {
    const { channelId, lastMessageId } = req.body;
    const userId = req.userId;

    // Check if user is channel member
    const channel = await Channel.findById(channelId);
    const isMember = channel.members.some(m => m.userId.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a channel member' });
    }

    // Get last few messages for context
    const messages = await Message.find({ channelId })
      .sort({ timestamp: -1 })
      .limit(5)
      .populate('sender', 'username');

    const context = messages
      .reverse()
      .map(msg => `${msg.sender.username}: ${msg.text}`)
      .join('\n');

    // Mock smart replies (replace with actual AI)
    const suggestions = await generateSmartReplies(context);

    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
};

// Detect sentiment
exports.detectSentiment = async (req, res, next) => {
  try {
    const { text } = req.body;

    // Mock sentiment analysis
    const sentiment = analyzeSentiment(text);

    res.json({ sentiment });
  } catch (error) {
    next(error);
  }
};

// Helper functions (Mock implementations - replace with actual AI)

async function generateSummary(conversation) {
  // TODO: Replace with actual OpenAI API call
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await openai.chat.completions.create({
  //   model: "gpt-3.5-turbo",
  //   messages: [
  //     { role: "system", content: "Summarize this conversation concisely." },
  //     { role: "user", content: conversation }
  //   ]
  // });
  // return response.choices[0].message.content;

  // Mock response
  return "This conversation discussed project updates, upcoming deadlines, and team coordination. Key points: Project is on track, deadline is next Friday, team meeting scheduled for tomorrow.";
}

async function translateText(text, targetLanguage) {
  // TODO: Replace with actual translation API
  // Mock translations
  const translations = {
    'es': 'Hola, ¿cómo estás?',
    'fr': 'Bonjour, comment allez-vous?',
    'de': 'Hallo, wie geht es dir?',
    'hi': 'नमस्ते, आप कैसे हैं?',
    'ja': 'こんにちは、お元気ですか？'
  };
  
  return translations[targetLanguage] || text;
}

async function generateSmartReplies(context) {
  // TODO: Replace with actual AI
  // Mock suggestions
  return [
    "That sounds great!",
    "I agree with that approach.",
    "Let me check and get back to you.",
    "Thanks for the update!",
    "Could you provide more details?"
  ];
}

function analyzeSentiment(text) {
  // TODO: Replace with actual sentiment analysis
  // Mock sentiment
  const positiveWords = ['good', 'great', 'awesome', 'excellent', 'happy', 'love'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return { label: 'positive', score: 0.8 };
  if (negativeCount > positiveCount) return { label: 'negative', score: 0.8 };
  return { label: 'neutral', score: 0.6 };
}

module.exports = exports;
