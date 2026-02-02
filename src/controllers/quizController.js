const Quiz = require('../models/Quiz');
const Channel = require('../models/Channel');
const Message = require('../models/Message');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create quiz
exports.createQuiz = async (req, res, next) => {
  try {
    const { 
      title, description, channelId, questions, timeLimit,
      shuffleQuestions, shuffleOptions, attemptsLimit, isResumable,
      isLiveMode, showAnswersAfterSubmit, teamMode, certificate
    } = req.body;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel || !channel.members.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create discussion threads for each question if enabled
    const processedQuestions = await Promise.all(questions.map(async (q, index) => {
      if (q.enableDiscussion) {
        const threadMessage = await Message.create({
          channelId,
          sender: userId,
          content: `Discussion: ${q.question}`,
          type: 'thread',
          metadata: { quizQuestion: true, questionIndex: index }
        });
        q.threadId = threadMessage._id;
      }
      return q;
    }));

    const quiz = new Quiz({
      title,
      description,
      channelId,
      createdBy: userId,
      questions: processedQuestions,
      timeLimit,
      shuffleQuestions,
      shuffleOptions,
      attemptsLimit,
      isResumable,
      isLiveMode,
      showAnswersAfterSubmit,
      teamMode,
      certificate
    });

    await quiz.save();
    await quiz.populate('createdBy', 'username avatar');

    const io = require('../sockets/socketManager').getIO();
    io.to(channelId).emit('quiz:created', quiz);

    res.status(201).json(quiz);
  } catch (error) {
    next(error);
  }
};

// Get quizzes for channel
exports.getChannelQuizzes = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const userId = req.userId;

    const channel = await Channel.findById(channelId);
    if (!channel || !channel.members.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const quizzes = await Quiz.find({ channelId })
      .populate('createdBy', 'username avatar')
      .select('-questions.correctAnswers -questions.explanation')
      .sort({ createdAt: -1 });

    res.json(quizzes);
  } catch (error) {
    next(error);
  }
};

// Get single quiz (for taking)
exports.getQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId)
      .populate('createdBy', 'username avatar');

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const channel = await Channel.findById(quiz.channelId);
    if (!channel || !channel.members.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check attempts limit
    const userAttempts = quiz.participants.filter(p => p.user.toString() === userId);
    if (quiz.attemptsLimit > 0 && userAttempts.length >= quiz.attemptsLimit) {
      return res.status(403).json({ error: 'Attempts limit reached' });
    }

    // Remove correct answers and explanations for participants
    const isCreator = quiz.createdBy._id.toString() === userId;
    const quizData = quiz.toObject();
    
    if (!isCreator) {
      quizData.questions = quizData.questions.map(q => {
        const { correctAnswers, explanation, ...rest } = q;
        return rest;
      });
    }

    // Shuffle if enabled
    if (quiz.shuffleQuestions && !isCreator) {
      quizData.questions = shuffleArray(quizData.questions);
    }
    if (quiz.shuffleOptions && !isCreator) {
      quizData.questions = quizData.questions.map(q => {
        if (q.options && q.options.length > 0) {
          q.options = shuffleArray(q.options);
        }
        return q;
      });
    }

    res.json(quizData);
  } catch (error) {
    next(error);
  }
};

// Start quiz attempt
exports.startQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isActive) {
      return res.status(400).json({ error: 'Quiz not available' });
    }

    const userAttempts = quiz.participants.filter(p => p.user.toString() === userId);
    if (quiz.attemptsLimit > 0 && userAttempts.length >= quiz.attemptsLimit) {
      return res.status(403).json({ error: 'Attempts limit reached' });
    }

    // Check for existing incomplete attempt
    const incompleteAttempt = userAttempts.find(p => !p.completedAt);
    if (incompleteAttempt && !quiz.isResumable) {
      return res.status(400).json({ error: 'Cannot resume quiz' });
    }

    if (!incompleteAttempt) {
      quiz.participants.push({
        user: userId,
        attemptNumber: userAttempts.length + 1,
        answers: [],
        score: 0,
        startedAt: new Date()
      });
      quiz.analytics.totalAttempts += 1;
      await quiz.save();
    }

    const io = require('../sockets/socketManager').getIO();
    io.to(quiz.channelId.toString()).emit('quiz:started', { quizId, userId });

    res.json({ message: 'Quiz started', attemptNumber: userAttempts.length + 1 });
  } catch (error) {
    next(error);
  }
};

// Submit answer
exports.submitAnswer = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { questionIndex, selectedAnswers, usedHint, timeTaken } = req.body;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isActive) {
      return res.status(400).json({ error: 'Quiz not available' });
    }

    const question = quiz.questions[questionIndex];
    if (!question) {
      return res.status(400).json({ error: 'Invalid question' });
    }

    let participant = quiz.participants.find(
      p => p.user.toString() === userId && !p.completedAt
    );

    if (!participant) {
      return res.status(400).json({ error: 'Quiz not started' });
    }

    const existingAnswer = participant.answers.find(a => a.questionIndex === questionIndex);
    if (existingAnswer) {
      return res.status(400).json({ error: 'Already answered' });
    }

    // Grade answer
    let isCorrect = false;
    let pointsEarned = 0;

    if (question.type === 'short-answer') {
      const userAnswer = selectedAnswers[0].toLowerCase().trim();
      isCorrect = question.correctAnswers.some(
        ans => ans.toLowerCase().trim() === userAnswer
      );
    } else if (question.type === 'mcq-multiple') {
      const sortedUser = [...selectedAnswers].sort();
      const sortedCorrect = [...question.correctAnswers].sort();
      isCorrect = JSON.stringify(sortedUser) === JSON.stringify(sortedCorrect);
    } else {
      isCorrect = question.correctAnswers.includes(selectedAnswers[0]);
    }

    if (isCorrect) {
      pointsEarned = question.points;
      if (usedHint) {
        pointsEarned = Math.max(0, pointsEarned - question.hintCost);
      }
      participant.score += pointsEarned;
    }

    participant.answers.push({
      questionIndex,
      selectedAnswers,
      isCorrect,
      pointsEarned,
      usedHint,
      answeredAt: new Date(),
      timeTaken
    });

    // Update analytics
    let questionStat = quiz.analytics.questionStats.find(s => s.questionIndex === questionIndex);
    if (!questionStat) {
      questionStat = {
        questionIndex,
        correctCount: 0,
        incorrectCount: 0,
        averageTime: 0
      };
      quiz.analytics.questionStats.push(questionStat);
    }
    
    if (isCorrect) {
      questionStat.correctCount += 1;
    } else {
      questionStat.incorrectCount += 1;
    }
    
    const totalAnswers = questionStat.correctCount + questionStat.incorrectCount;
    questionStat.averageTime = ((questionStat.averageTime * (totalAnswers - 1)) + timeTaken) / totalAnswers;

    await quiz.save();

    const io = require('../sockets/socketManager').getIO();
    io.to(quiz.channelId.toString()).emit('quiz:answered', {
      quizId,
      userId,
      questionIndex
    });

    const response = {
      isCorrect,
      pointsEarned,
      score: participant.score,
      totalQuestions: quiz.questions.length,
      answeredQuestions: participant.answers.length
    };

    if (quiz.showAnswersAfterSubmit) {
      response.correctAnswers = question.correctAnswers;
      response.explanation = question.explanation;
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Submit entire quiz
exports.submitQuiz = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    let participant = quiz.participants.find(
      p => p.user.toString() === userId && !p.completedAt
    );

    if (!participant) {
      return res.status(400).json({ error: 'No active attempt' });
    }

    participant.completedAt = new Date();

    // Update average score
    const completedParticipants = quiz.participants.filter(p => p.completedAt);
    const totalScore = completedParticipants.reduce((sum, p) => sum + p.score, 0);
    quiz.analytics.averageScore = totalScore / completedParticipants.length;

    // Award badges
    await awardBadges(quiz, participant, userId);

    await quiz.save();

    const io = require('../sockets/socketManager').getIO();
    io.to(quiz.channelId.toString()).emit('quiz:completed', {
      quizId,
      userId,
      score: participant.score
    });

    res.json({
      score: participant.score,
      totalQuestions: quiz.questions.length,
      completedAt: participant.completedAt,
      badges: quiz.badges.filter(b => b.awardedTo.includes(userId))
    });
  } catch (error) {
    next(error);
  }
};

// Get hint
exports.getHint = async (req, res, next) => {
  try {
    const { quizId, questionIndex } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const question = quiz.questions[questionIndex];
    if (!question || !question.hint) {
      return res.status(404).json({ error: 'No hint available' });
    }

    res.json({
      hint: question.hint,
      cost: question.hintCost
    });
  } catch (error) {
    next(error);
  }
};

// Get quiz results with review
exports.getQuizResults = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId)
      .populate('participants.user', 'username avatar')
      .populate('createdBy', 'username avatar');

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const userParticipant = quiz.participants.find(
      p => p.user._id.toString() === userId && p.completedAt
    );

    if (!userParticipant) {
      return res.status(404).json({ error: 'No completed attempt found' });
    }

    // Detailed review with correct answers and explanations
    const review = quiz.questions.map((q, index) => {
      const userAnswer = userParticipant.answers.find(a => a.questionIndex === index);
      return {
        question: q.question,
        type: q.type,
        options: q.options,
        userAnswers: userAnswer?.selectedAnswers || [],
        correctAnswers: q.correctAnswers,
        isCorrect: userAnswer?.isCorrect || false,
        pointsEarned: userAnswer?.pointsEarned || 0,
        explanation: q.explanation,
        timeTaken: userAnswer?.timeTaken || 0
      };
    });

    res.json({
      quiz: {
        title: quiz.title,
        description: quiz.description
      },
      score: userParticipant.score,
      totalQuestions: quiz.questions.length,
      completedAt: userParticipant.completedAt,
      review,
      badges: quiz.badges.filter(b => b.awardedTo.includes(userId))
    });
  } catch (error) {
    next(error);
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId)
      .populate('participants.user', 'username avatar');

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const leaderboard = quiz.participants
      .filter(p => p.completedAt)
      .map(p => ({
        user: p.user,
        score: p.score,
        totalQuestions: quiz.questions.length,
        completedAt: p.completedAt,
        timeTaken: (p.completedAt - p.startedAt) / 1000,
        badges: quiz.badges.filter(b => b.awardedTo.includes(p.user._id)).map(b => b.name)
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken - b.timeTaken;
      });

    res.json({
      quiz: {
        title: quiz.title,
        totalQuestions: quiz.questions.length
      },
      leaderboard,
      analytics: quiz.analytics
    });
  } catch (error) {
    next(error);
  }
};

// Toggle quiz active status (start/stop)
exports.toggleQuizStatus = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    quiz.isActive = !quiz.isActive;
    await quiz.save();

    const io = require('../sockets/socketManager').getIO();
    io.to(quiz.channelId.toString()).emit('quiz:statusChanged', {
      quizId,
      isActive: quiz.isActive
    });

    res.json({ isActive: quiz.isActive });
  } catch (error) {
    next(error);
  }
};

// Live mode: Next question
exports.nextQuestion = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isLiveMode) {
      return res.status(400).json({ error: 'Not in live mode' });
    }

    if (quiz.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (quiz.currentQuestionIndex < quiz.questions.length - 1) {
      quiz.currentQuestionIndex += 1;
      await quiz.save();

      const io = require('../sockets/socketManager').getIO();
      io.to(quiz.channelId.toString()).emit('quiz:nextQuestion', {
        quizId,
        questionIndex: quiz.currentQuestionIndex
      });

      res.json({ questionIndex: quiz.currentQuestionIndex });
    } else {
      res.status(400).json({ error: 'No more questions' });
    }
  } catch (error) {
    next(error);
  }
};

// Live mode: Reveal answer
exports.revealAnswer = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const { questionIndex } = req.body;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isLiveMode) {
      return res.status(400).json({ error: 'Not in live mode' });
    }

    if (quiz.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const question = quiz.questions[questionIndex];
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const io = require('../sockets/socketManager').getIO();
    io.to(quiz.channelId.toString()).emit('quiz:answerRevealed', {
      quizId,
      questionIndex,
      correctAnswers: question.correctAnswers,
      explanation: question.explanation
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Generate certificate
exports.generateCertificate = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId)
      .populate('participants.user', 'username')
      .populate('createdBy', 'username');

    if (!quiz || !quiz.certificate.enabled) {
      return res.status(400).json({ error: 'Certificates not enabled' });
    }

    const participant = quiz.participants.find(
      p => p.user._id.toString() === userId && p.completedAt
    );

    if (!participant) {
      return res.status(404).json({ error: 'No completed attempt' });
    }

    const percentage = (participant.score / quiz.questions.reduce((sum, q) => sum + q.points, 0)) * 100;
    if (percentage < quiz.certificate.passingScore) {
      return res.status(400).json({ error: 'Did not meet passing score' });
    }

    // Generate PDF certificate
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
    const filename = `certificate-${quizId}-${userId}.pdf`;
    const filepath = path.join(__dirname, '../../uploads/certificates', filename);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    doc.pipe(fs.createWriteStream(filepath));

    // Certificate design
    doc.fontSize(40).text('Certificate of Achievement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text('This certifies that', { align: 'center' });
    doc.moveDown();
    doc.fontSize(30).text(participant.user.username, { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).text('has successfully completed', { align: 'center' });
    doc.moveDown();
    doc.fontSize(25).text(quiz.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Score: ${participant.score} (${percentage.toFixed(1)}%)`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });

    doc.end();

    doc.on('finish', () => {
      res.json({
        certificateUrl: `/uploads/certificates/${filename}`,
        score: participant.score,
        percentage: percentage.toFixed(1)
      });
    });
  } catch (error) {
    next(error);
  }
};

// Get analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (quiz.createdBy.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const analytics = {
      totalAttempts: quiz.analytics.totalAttempts,
      averageScore: quiz.analytics.averageScore,
      completionRate: (quiz.participants.filter(p => p.completedAt).length / quiz.participants.length * 100).toFixed(1),
      questionStats: quiz.analytics.questionStats.map((stat, index) => ({
        question: quiz.questions[index].question,
        correctCount: stat.correctCount,
        incorrectCount: stat.incorrectCount,
        accuracy: ((stat.correctCount / (stat.correctCount + stat.incorrectCount)) * 100).toFixed(1),
        averageTime: stat.averageTime.toFixed(1)
      })),
      difficultQuestions: quiz.analytics.questionStats
        .map((stat, index) => ({
          index,
          question: quiz.questions[index].question,
          accuracy: (stat.correctCount / (stat.correctCount + stat.incorrectCount)) * 100
        }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5)
    };

    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

// Helper functions
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function awardBadges(quiz, participant, userId) {
  const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0);
  
  // Perfect score badge
  if (participant.score === maxScore) {
    let badge = quiz.badges.find(b => b.name === 'Perfect Score');
    if (!badge) {
      badge = {
        name: 'Perfect Score',
        description: 'Achieved 100% on the quiz',
        icon: '🏆',
        criteria: 'perfect_score',
        awardedTo: []
      };
      quiz.badges.push(badge);
    }
    if (!badge.awardedTo.includes(userId)) {
      badge.awardedTo.push(userId);
    }
  }

  // Speed demon badge (completed in less than average time)
  const timeTaken = (participant.completedAt - participant.startedAt) / 1000;
  const completedParticipants = quiz.participants.filter(p => p.completedAt && p.user.toString() !== userId);
  if (completedParticipants.length > 0) {
    const avgTime = completedParticipants.reduce((sum, p) => sum + (p.completedAt - p.startedAt) / 1000, 0) / completedParticipants.length;
    if (timeTaken < avgTime * 0.75) {
      let badge = quiz.badges.find(b => b.name === 'Speed Demon');
      if (!badge) {
        badge = {
          name: 'Speed Demon',
          description: 'Completed quiz 25% faster than average',
          icon: '⚡',
          criteria: 'speed_demon',
          awardedTo: []
        };
        quiz.badges.push(badge);
      }
      if (!badge.awardedTo.includes(userId)) {
        badge.awardedTo.push(userId);
      }
    }
  }

  // First place badge
  const sortedParticipants = quiz.participants
    .filter(p => p.completedAt)
    .sort((a, b) => b.score - a.score);
  if (sortedParticipants[0]?.user.toString() === userId) {
    let badge = quiz.badges.find(b => b.name === 'First Place');
    if (!badge) {
      badge = {
        name: 'First Place',
        description: 'Achieved the highest score',
        icon: '🥇',
        criteria: 'first_place',
        awardedTo: []
      };
      quiz.badges.push(badge);
    }
    if (!badge.awardedTo.includes(userId)) {
      badge.awardedTo.push(userId);
    }
  }
}
