import express from 'express';
import { protect } from '../middleware/auth.js';
import { unifiedSearch } from '../controllers/searchController.js';

const router = express.Router();

// Mount protection middleware to ensure all search queries are authenticated
router.use(protect);

router.get('/unified', unifiedSearch);

export default router;
