
import express from 'express';
import {
    createLiveClass,
    getLiveClasses,
    deleteLiveClass
} from '../controllers/liveClassController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
    .get(getLiveClasses)
    .post(createLiveClass);

router.route('/:id')
    .delete(deleteLiveClass);

export default router;
