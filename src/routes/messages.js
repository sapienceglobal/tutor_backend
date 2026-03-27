import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
} from '../controllers/messageController.js';

const router = express.Router();

router.use(protect, authorize('tutor', 'student'));

router.get('/conversations', getConversations);
router.get('/conversations/:partnerId', getConversationMessages);
router.patch('/conversations/:partnerId/read', markConversationAsRead);
router.post('/', sendMessage);

export default router;
