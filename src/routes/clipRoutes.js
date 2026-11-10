const express = require('express');
const env = require('../config/env');
const clipController = require('../controllers/clipController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.post(
  '/',
  requireAuth,
  express.raw({ type: ['video/mp4', 'application/octet-stream'], limit: env.clipMaxBytes }),
  clipController.upload,
);

module.exports = router;
