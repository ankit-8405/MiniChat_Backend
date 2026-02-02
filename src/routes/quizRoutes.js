const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Quiz CRUD
router.post('/', quizController.createQuiz);
router.get('/channel/:channelId', quizController.getChannelQuizzes);
router.get('/:quizId', quizController.getQuiz);

// Quiz participation
router.post('/:quizId/start', quizController.startQuiz);
router.post('/:quizId/answer', quizController.submitAnswer);
router.post('/:quizId/submit', quizController.submitQuiz);
router.get('/:quizId/hint/:questionIndex', quizController.getHint);

// Results and review
router.get('/:quizId/results', quizController.getQuizResults);
router.get('/:quizId/leaderboard', quizController.getLeaderboard);
router.get('/:quizId/analytics', quizController.getAnalytics);

// Host controls
router.patch('/:quizId/toggle', quizController.toggleQuizStatus);
router.post('/:quizId/next-question', quizController.nextQuestion);
router.post('/:quizId/reveal-answer', quizController.revealAnswer);

// Certificate
router.get('/:quizId/certificate', quizController.generateCertificate);

module.exports = router;
