import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
    content: {
        attachments: [{
            name: String,
            url: String,
            type: String,
        }],
    }
});

const LessonX = mongoose.model('LessonX', lessonSchema);

const val = [
    "[\n  {\n    name: 'Screenshot (181)edit.png',\n    url: 'https://res.cloudinary.com',\n    type: 'image/png'\n  }\n]"
];

try {
    const doc = new LessonX({ content: { attachments: val } });
    const err = doc.validateSync();
    if (err) {
        console.log("Validation Error:", err.message);
        if (err.errors && err.errors['content.attachments.0']) {
            console.log("Detailed Error:", err.errors['content.attachments.0'].message);
        }
    } else {
        console.log("Success");
    }
} catch (e) {
    console.log("Caught Error:", e);
}
process.exit(0);
