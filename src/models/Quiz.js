const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['mcq-single', 'mcq-multiple', 'true-false', 'short-answer'],
      default: 'mcq-single'
    },
    options: [{
      type: String
    }],
    correctAnswers: [{
      type: mongoose.Schema.Types.Mixed // Can be number (index) or string (short answer)
    }],
    points: {
      type: Number,
      default: 1
    },
    timeLimit: {
      type: Number, // per-question timer in seconds
      default: 0
    },
    hint: {
      type: String,
      default: ''
    },
    hintCost: {
      type: Number,
      default: 0 // points deducted for using hint
    },
    explanation: {
      type: String,
      default: ''
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message' // Link to discussion thread
    }
  }],
  timeLimit: {
    type: Number, // overall quiz time limit in seconds
    default: 0 // 0 means no limit
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  shuffleOptions: {
    type: Boolean,
    default: false
  },
  attemptsLimit: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  isResumable: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: false // Start as inactive, host can activate
  },
  isLiveMode: {
    type: Boolean,
    default: false
  },
  currentQuestionIndex: {
    type: Number,
    default: 0 // For live mode
  },
  showAnswersAfterSubmit: {
    type: Boolean,
    default: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    attemptNumber: {
      type: Number,
      default: 1
    },
    answers: [{
      questionIndex: Number,
      selectedAnswers: [mongoose.Schema.Types.Mixed], // Array for multiple answers
      isCorrect: Boolean,
      pointsEarned: Number,
      usedHint: Boolean,
      answeredAt: Date,
      timeTaken: Number // seconds
    }],
    score: {
      type: Number,
      default: 0
    },
    startedAt: Date,
    completedAt: Date,
    isPaused: Boolean,
    pausedAt: Date,
    resumedAt: Date
  }],
  teamMode: {
    enabled: {
      type: Boolean,
      default: false
    },
    teams: [{
      name: String,
      members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      score: {
        type: Number,
        default: 0
      }
    }]
  },
  badges: [{
    name: String,
    description: String,
    icon: String,
    criteria: String, // e.g., "perfect_score", "speed_demon", "first_place"
    awardedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  certificate: {
    enabled: {
      type: Boolean,
      default: false
    },
    template: String,
    passingScore: {
      type: Number,
      default: 70 // percentage
    }
  },
  analytics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    questionStats: [{
      questionIndex: Number,
      correctCount: Number,
      incorrectCount: Number,
      averageTime: Number
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
quizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
