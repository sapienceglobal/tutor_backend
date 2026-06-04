import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from '../src/models/Course.js';
import Category from '../src/models/Category.js';

dotenv.config();

const UNSPLASH_IMAGES = {
    mathematics: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=60',
    physics: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=60',
    chemistry: 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=800&auto=format&fit=crop&q=60',
    computer_science: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=800&auto=format&fit=crop&q=60',
    english: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=60',
    music: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=60',
    general: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=60'
};

const getThumbnailForCourse = (title, categoryName) => {
    const t = (title || '').toLowerCase();
    const c = (categoryName || '').toLowerCase();

    // Check title keywords first
    if (t.includes('math') || t.includes('algebra') || t.includes('calculus') || t.includes('geometry')) {
        return UNSPLASH_IMAGES.mathematics;
    }
    if (t.includes('physic') || t.includes('quantum') || t.includes('mechanic')) {
        return UNSPLASH_IMAGES.physics;
    }
    if (t.includes('chem') || t.includes('organic')) {
        return UNSPLASH_IMAGES.chemistry;
    }
    if (t.includes('flutter') || t.includes('coding') || t.includes('web') || t.includes('bootcamp') || t.includes('computer') || t.includes('python') || t.includes('javascript') || t.includes('program')) {
        return UNSPLASH_IMAGES.computer_science;
    }
    if (t.includes('music') || t.includes('piano') || t.includes('guitar') || t.includes('singing') || t.includes('vocal')) {
        return UNSPLASH_IMAGES.music;
    }
    if (t.includes('english') || t.includes('grammar') || t.includes('literature') || t.includes('writing') || t.includes('book')) {
        return UNSPLASH_IMAGES.english;
    }

    // Fallback to categoryName checking
    if (c.includes('math')) return UNSPLASH_IMAGES.mathematics;
    if (c.includes('physic')) return UNSPLASH_IMAGES.physics;
    if (c.includes('chem')) return UNSPLASH_IMAGES.chemistry;
    if (c.includes('computer') || c.includes('science') || c.includes('prog')) return UNSPLASH_IMAGES.computer_science;
    if (c.includes('music')) return UNSPLASH_IMAGES.music;
    if (c.includes('english')) return UNSPLASH_IMAGES.english;

    return UNSPLASH_IMAGES.general;
};

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const courses = await Course.find({});
        console.log(`Auditing ${courses.length} courses...`);

        let updatedCount = 0;

        for (const course of courses) {
            // Find category to get category name
            let categoryName = '';
            if (course.categoryId) {
                const cat = await Category.findById(course.categoryId);
                if (cat) categoryName = cat.name;
            }

            const currentThumbnail = course.thumbnail ? course.thumbnail.trim() : '';

            // Conditions under which a thumbnail needs an update:
            // 1. Falsy/empty string
            // 2. Contains placeholder url
            // 3. Contains bing/google search image detail page URL instead of direct image URL
            // 4. Broken base64 strings
            const isFalsy = !currentThumbnail;
            const isPlaceholder = currentThumbnail.includes('placeholder.com') || currentThumbnail.includes('via.placeholder');
            const isSearchPage = currentThumbnail.includes('bing.com/images/search') || currentThumbnail.includes('google.com/imgres');
            const isBase64 = currentThumbnail.startsWith('data:image');

            if (isFalsy || isPlaceholder || isSearchPage || isBase64) {
                const newThumbnail = getThumbnailForCourse(course.title, categoryName);
                console.log(`🔄 Updating Course: "${course.title}"`);
                console.log(`   Old: ${currentThumbnail ? currentThumbnail.substring(0, 60) + '...' : '[EMPTY]'}`);
                console.log(`   New: ${newThumbnail}`);
                
                await Course.updateOne({ _id: course._id }, { $set: { thumbnail: newThumbnail } });
                updatedCount++;
            }
        }

        console.log(`✅ Successfully updated ${updatedCount} courses with beautiful Unsplash thumbnails!`);
        await mongoose.disconnect();
    } catch (err) {
        console.error('Error during course thumbnail update:', err);
        process.exit(1);
    }
};

run();
