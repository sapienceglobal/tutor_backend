import Tutor from '../models/Tutor.js';
import User from '../models/User.js';
import Category from '../models/Category.js';

// @desc    Get all tutors with filters
// @route   GET /api/tutors
export const getAllTutors = async (req, res) => {
  try {
    const { categoryId, minRating, maxRate, search } = req.query;

    // Build filter object
    let filter = { isVerified: true };

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    if (maxRate) {
      filter.hourlyRate = { $lte: parseFloat(maxRate) };
    }

    const tutors = await Tutor.find(filter)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon')
      .sort({ rating: -1, studentsCount: -1 });

    // Search by name if provided
    let filteredTutors = tutors;
    if (search) {
      filteredTutors = tutors.filter(tutor =>
        tutor.userId.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      count: filteredTutors.length,
      tutors: filteredTutors
    });
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get single tutor by ID
// @route   GET /api/tutors/:id
export const getTutorById = async (req, res) => {
  try {
    const { id } = req.params;

    const tutor = await Tutor.findById(id)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon description');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    res.status(200).json({
      success: true,
      tutor
    });
  } catch (error) {
    console.error('Get tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get tutors by category
// @route   GET /api/tutors/category/:categoryId
export const getTutorsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const tutors = await Tutor.find({ categoryId, isVerified: true })
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon')
      .sort({ rating: -1 });

    res.status(200).json({
      success: true,
      category: category.name,
      count: tutors.length,
      tutors
    });
  } catch (error) {
    console.error('Get tutors by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Create tutor profile
// @route   POST /api/tutors
export const createTutor = async (req, res) => {
  try {
    const {
      categoryId,
      hourlyRate,
      experience,
      subjects,
      availability,
      bio
    } = req.body;

    if (!categoryId || !hourlyRate || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Category, hourly rate, and experience are required'
      });
    }

    // Check if user already has a tutor profile
    const existingTutor = await Tutor.findOne({ userId: req.user.id });
    if (existingTutor) {
      return res.status(400).json({
        success: false,
        message: 'Tutor profile already exists'
      });
    }

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const tutor = await Tutor.create({
      userId: req.user.id,
      categoryId,
      hourlyRate,
      experience,
      subjects: subjects || [],
      availability: availability || [],
      bio: bio || '',
      title: req.body.title || '',
      website: req.body.website || '',
      location: req.body.location || ''
    });

    // Update user role to tutor
    await User.findByIdAndUpdate(req.user.id, { role: 'tutor' });

    // Update category tutor count
    category.tutorCount += 1;
    await category.save();

    const populatedTutor = await Tutor.findById(tutor._id)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon');

    res.status(201).json({
      success: true,
      message: 'Tutor profile created successfully',
      tutor: populatedTutor
    });
  } catch (error) {
    console.error('Create tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update tutor profile
// @route   PATCH /api/tutors/:id
export const updateTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      hourlyRate,
      experience,
      subjects,
      availability,
      bio
    } = req.body;

    const tutor = await Tutor.findById(id);

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Check if user owns this tutor profile
    if (tutor.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    if (categoryId) tutor.categoryId = categoryId;
    if (hourlyRate) tutor.hourlyRate = hourlyRate;
    if (experience) tutor.experience = experience;
    if (subjects) tutor.subjects = subjects;
    if (availability) tutor.availability = availability;
    if (availability) tutor.availability = availability;
    if (bio) tutor.bio = bio;
    if (req.body.title) tutor.title = req.body.title;
    if (req.body.website) tutor.website = req.body.website;
    if (req.body.location) tutor.location = req.body.location;

    await tutor.save();

    const updatedTutor = await Tutor.findById(id)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon');

    res.status(200).json({
      success: true,
      message: 'Tutor profile updated successfully',
      tutor: updatedTutor
    });
  } catch (error) {
    console.error('Update tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Delete tutor profile
// @route   DELETE /api/tutors/:id
export const deleteTutor = async (req, res) => {
  try {
    const { id } = req.params;

    const tutor = await Tutor.findById(id);

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Check if user owns this tutor profile
    if (tutor.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile'
      });
    }

    // Update category tutor count
    const category = await Category.findById(tutor.categoryId);
    if (category) {
      category.tutorCount = Math.max(0, category.tutorCount - 1);
      await category.save();
    }

    await tutor.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Tutor profile deleted successfully'
    });
  } catch (error) {
    console.error('Delete tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get current logged in tutor profile
// @route   GET /api/tutors/profile
export const getCurrentTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id })
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor profile not found'
      });
    }

    res.status(200).json({
      success: true,
      tutor
    });
  } catch (error) {
    console.error('Get current tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};