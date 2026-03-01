import Page from '../models/Page.js';
import Blog from '../models/Blog.js';
import Settings from '../models/Settings.js';

// --- PUBLIC SETTINGS ---
export const getPublicSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        // Return only public-safe fields
        res.status(200).json({
            success: true,
            settings: {
                siteName: settings.siteName,
                footerText: settings.footerText,
                primaryColor: settings.primaryColor,
                contactEmail: settings.contactEmail,
                supportEmail: settings.supportEmail,
                supportPhone: settings.supportPhone,
                contactAddress: settings.contactAddress,
                facebookLink: settings.facebookLink,
                twitterLink: settings.twitterLink,
                instagramLink: settings.instagramLink,
                linkedinLink: settings.linkedinLink,
                youtubeLink: settings.youtubeLink,
                favicon: settings.favicon,
                googleAnalyticsId: settings.googleAnalyticsId,
                metaPixelId: settings.metaPixelId,
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// --- PAGES ---

export const getPages = async (req, res) => {
    try {
        const query = req.user?.role === 'admin' || req.user?.role === 'superadmin' ? {} : { isPublished: true };
        const pages = await Page.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: pages.length, data: pages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export const getPageBySlug = async (req, res) => {
    try {
        const query = { slug: req.params.slug };
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
            query.isPublished = true;
        }

        const page = await Page.findOne(query);
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

        res.status(200).json({ success: true, data: page });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export const createPage = async (req, res) => {
    try {
        req.body.author = req.user.id;
        const page = await Page.create(req.body);
        res.status(201).json({ success: true, data: page });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Slug already exists' });
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

export const updatePage = async (req, res) => {
    try {
        let page = await Page.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

        page = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: page });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

export const deletePage = async (req, res) => {
    try {
        const page = await Page.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
        await page.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


// --- BLOGS ---

export const getBlogs = async (req, res) => {
    try {
        let query = {};
        if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
            // Admins see all blogs including drafts and scheduled
            query = {};
        } else {
            // Public: only published or scheduled blogs whose date has passed
            query = {
                $or: [
                    { status: 'published', isPublished: true },
                    { status: 'scheduled', scheduledPublishAt: { $lte: new Date() } },
                ]
            };
        }
        // Category filter
        if (req.query.category && req.query.category !== 'All') {
            query.category = req.query.category;
        }
        const blogs = await Blog.find(query).populate('author', 'name avatar').sort({ createdAt: -1 });
        // Get distinct categories for filter dropdown
        const categories = await Blog.distinct('category');
        res.status(200).json({ success: true, count: blogs.length, data: blogs, categories });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export const getBlogBySlug = async (req, res) => {
    try {
        const query = { slug: req.params.slug };
        if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
            query.isPublished = true;
        }

        const blog = await Blog.findOne(query).populate('author', 'name avatar bio');
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export const createBlog = async (req, res) => {
    try {
        req.body.author = req.user.id;
        // Handle scheduled status
        if (req.body.scheduledPublishAt) {
            req.body.status = 'scheduled';
            req.body.isPublished = false;
        } else if (req.body.status === 'draft') {
            req.body.isPublished = false;
        } else {
            req.body.status = 'published';
            req.body.isPublished = true;
        }
        const blog = await Blog.create(req.body);
        res.status(201).json({ success: true, data: blog });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Slug already exists' });
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

export const updateBlog = async (req, res) => {
    try {
        let blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

        blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

export const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        await blog.deleteOne();
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
