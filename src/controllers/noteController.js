import Note from '../models/Note.js';

// @desc    Save or Update a lesson note
// @route   POST /api/notes
// @access  Private
export const saveNote = async (req, res) => {
  try {
    const { noteId, courseId, lessonId, content, title } = req.body;

    let note;
    if (noteId) {
      // Edit existing note
      note = await Note.findOneAndUpdate(
        { _id: noteId, studentId: req.user.id },
        { content: content || '', title: title || '', updatedAt: new Date() },
        { new: true }
      );
      if (!note) {
        return res.status(404).json({ success: false, message: 'Note not found or unauthorized' });
      }
    } else {
      // Create new note
      if (!courseId || !lessonId) {
        return res.status(400).json({ success: false, message: 'Course ID and Lesson ID are required for new notes' });
      }
      note = await Note.create({
        studentId: req.user.id,
        courseId,
        lessonId,
        content: content || '',
        title: title || '',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Note saved successfully',
      note
    });
  } catch (error) {
    console.error('Save note error:', error);
    res.status(500).json({ success: false, message: 'Server Error saving note' });
  }
};

// @desc    Get all notes for a student in a course
// @route   GET /api/notes/course/:courseId
// @access  Private
export const getCourseNotes = async (req, res) => {
  try {
    const { courseId } = req.params;

    const notes = await Note.find({
      studentId: req.user.id,
      courseId
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      notes
    });
  } catch (error) {
    console.error('Get course notes error:', error);
    res.status(500).json({ success: false, message: 'Server Error fetching notes' });
  }
};

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findOneAndDelete({
      _id: id,
      studentId: req.user.id
    });

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found or unauthorized' });
    }

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ success: false, message: 'Server Error deleting note' });
  }
};
