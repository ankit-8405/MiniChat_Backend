const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const authValidation = {
  signup: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('mobile')
      .optional()
      .trim()
      .matches(/^[0-9]{10}$/)
      .withMessage('Mobile number must be 10 digits'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Invalid email address'),
    validate
  ],
  login: [
    body('mobile')
      .optional()
      .trim()
      .matches(/^[0-9]{10}$/)
      .withMessage('Mobile number must be 10 digits'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Invalid email address'),
    validate
  ]
};

const channelValidation = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Channel name must be between 1 and 50 characters')
      .matches(/^[a-zA-Z0-9-_\s]+$/)
      .withMessage('Channel name can only contain letters, numbers, spaces, hyphens, and underscores'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description must be less than 200 characters'),
    body('isPrivate')
      .optional()
      .isBoolean()
      .withMessage('isPrivate must be a boolean'),
    body('password')
      .optional()
      .isLength({ min: 4, max: 50 })
      .withMessage('Password must be between 4 and 50 characters'),
    validate
  ],
  join: [
    param('channelId').isMongoId().withMessage('Invalid channel ID'),
    body('password')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .withMessage('Password must be a string'),
    validate
  ]
};

const messageValidation = {
  get: [
    param('channelId').isMongoId().withMessage('Invalid channel ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  send: [
    body('channelId').isMongoId().withMessage('Invalid channel ID'),
    body('text')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Message must be between 1 and 2000 characters'),
    validate
  ]
};

module.exports = {
  authValidation,
  channelValidation,
  messageValidation
};
