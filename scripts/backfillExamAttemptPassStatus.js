import '../src/config/loadEnv.js';
import mongoose from 'mongoose';
import connectDB from '../src/config/database.js';
import { ExamAttempt } from '../src/models/Exam.js';
import { evaluatePass } from '../src/utils/examScoring.js';

const APPLY = process.argv.includes('--apply');

const run = async () => {
  await connectDB();

  const attempts = await ExamAttempt.find({})
    .populate('examId', 'totalMarks passingPercentage passingMarks');

  let scanned = 0;
  let mismatched = 0;
  let updated = 0;
  const preview = [];

  for (const attempt of attempts) {
    scanned += 1;
    if (!attempt.examId) continue;

    const evaluation = evaluatePass({
      score: attempt.score,
      totalMarks: attempt.examId.totalMarks,
      passingPercentage: attempt.examId.passingPercentage,
      passingMarks: attempt.examId.passingMarks,
    });

    const expectedPassed = evaluation.isPassed;
    if (attempt.isPassed !== expectedPassed) {
      mismatched += 1;
      if (preview.length < 20) {
        preview.push({
          attemptId: String(attempt._id),
          score: attempt.score,
          existing: attempt.isPassed,
          expected: expectedPassed,
          passingPercentage: evaluation.passingPercentage,
        });
      }

      if (APPLY) {
        attempt.isPassed = expectedPassed;
        attempt.percentage = evaluation.displayPercentage;
        await attempt.save();
        updated += 1;
      }
    }
  }

  console.log(`Scanned attempts: ${scanned}`);
  console.log(`Mismatched attempts: ${mismatched}`);
  console.log(`Updated attempts: ${updated}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  if (preview.length > 0) {
    console.log('Preview (max 20 rows):');
    preview.forEach((row, index) => {
      console.log(
        `${index + 1}. attempt=${row.attemptId} score=${row.score} old=${row.existing} new=${row.expected} pass%=${row.passingPercentage}`
      );
    });
  }

  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Backfill failed:', error);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors
  }
  process.exit(1);
});
