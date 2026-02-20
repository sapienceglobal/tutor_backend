import Skill from '../models/Skill.js';
import Topic from '../models/Topic.js';

// --- SKILLS ---

export const createSkill = async (req, res) => {
    try {
        const { name, description } = req.body;
        // Assuming req.user.tutorId is populated via middleware or we look it up
        // For now, using req.user.id and finding tutor
        // Better: Ensure protect middleware adds tutorId if possible, or lookup here
        const tutorId = req.user.tutorId; // Needs updated auth middleware or lookup

        const skill = await Skill.create({
            name,
            description,
            tutorId
        });

        res.status(201).json({ success: true, skill });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSkills = async (req, res) => {
    try {
        const skills = await Skill.find({ tutorId: req.user.tutorId });
        res.status(200).json({ success: true, skills });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- TOPICS ---

export const createTopic = async (req, res) => {
    try {
        const { name, description, courseId } = req.body;
        const tutorId = req.user.tutorId;

        const topic = await Topic.create({
            name,
            description,
            courseId,
            tutorId
        });

        res.status(201).json({ success: true, topic });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTopics = async (req, res) => {
    try {
        const topics = await Topic.find({ tutorId: req.user.tutorId }).populate('courseId', 'title');
        res.status(200).json({ success: true, topics });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
