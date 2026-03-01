import express from 'express';
import {
    getPages,
    getPageBySlug,
    createPage,
    updatePage,
    deletePage,
    getBlogs,
    getBlogBySlug,
    createBlog,
    updateBlog,
    deleteBlog,
    getPublicSettings
} from '../controllers/cmsController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// --- PUBLIC ROUTES ---
router.get('/settings', getPublicSettings);
router.get('/pages', getPages);
router.get('/pages/:slug', getPageBySlug);

router.get('/blogs', getBlogs);
router.get('/blogs/:slug', getBlogBySlug);

// --- PROTECTED ADMIN/SUPERADMIN ROUTES ---
router.use(protect);
router.use(authorize('admin', 'superadmin'));

// Admin Pages
router.post('/pages', createPage);
router.put('/pages/:id', updatePage);
router.delete('/pages/:id', deletePage);

// Admin Blogs
router.post('/blogs', createBlog);
router.put('/blogs/:id', updateBlog);
router.delete('/blogs/:id', deleteBlog);

export default router;
