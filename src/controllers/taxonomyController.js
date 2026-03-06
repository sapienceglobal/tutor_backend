import Skill from '../models/Skill.js';
import Topic from '../models/Topic.js';
import Tutor from '../models/Tutor.js';

// --- SKILLS ---

export const createSkill = async (req, res) => {
    try {
        const { name, description } = req.body;

        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) return res.status(404).json({ success: false, message: 'Tutor profile not found' });

        const skill = await Skill.create({
            name,
            description,
            tutorId: tutor._id
        });

        res.status(201).json({ success: true, skill });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSkills = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) return res.status(404).json({ success: false, message: 'Tutor profile not found' });

        const skills = await Skill.find({ tutorId: tutor._id });
        res.status(200).json({ success: true, skills });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- TOPICS ---

export const createTopic = async (req, res) => {
    try {
        const { name, description, courseId } = req.body;

        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) return res.status(404).json({ success: false, message: 'Tutor profile not found' });

        const topicData = {
            name,
            description,
            tutorId: tutor._id
        };
        // courseId can be empty string from UI, which fails ObjectId casting
        if (courseId) {
            topicData.courseId = courseId;
        }

        const topic = await Topic.create(topicData);
        res.status(201).json({ success: true, topic });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTopics = async (req, res) => {
    try {
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) return res.status(404).json({ success: false, message: 'Tutor profile not found' });

        const topics = await Topic.find({ tutorId: tutor._id }).populate('courseId', 'title');
        res.status(200).json({ success: true, topics });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
