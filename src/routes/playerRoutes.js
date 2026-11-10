const express = require('express');
const playerController = require('../controllers/playerController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.get('/progress', playerController.progress);
router.post('/game-over', playerController.gameOver);
router.post('/continue', playerController.continueGame);
router.delete('/', playerController.deleteAccount);

module.exports = router;
