import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
    name: String,
    url: String,
    type: String,
});

const lessonSchema = new mongoose.Schema({
    content: {
        attachments: [{
            name: String,
            url: String,
            type: String,
        }],
    }
});

const Lesson = mongoose.model('LessonX', lessonSchema);

const val = [
    "[\n  {\n    name: 'Screenshot (181)edit.png',\n    url: 'https://res.cloudinary.com',\n    type: 'image/png'\n  }\n]"
];

try {
    const doc = new Lesson({ content: { attachments: val } });
    doc.validateSync();
    console.log("Success");
} catch (e) {
    console.log("Error:", e.errors['content.attachments.0'].message);
}
