import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Model Imports ────────────────────────────────────────────────────────────
import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import Course from '../src/models/Course.js';
import Enrollment from '../src/models/Enrollment.js';
import { Exam, ExamAttempt } from '../src/models/Exam.js';
import ExamReevaluationRequest from '../src/models/ExamReevaluationRequest.js';
import Batch from '../src/models/Batch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

const ago = (days, hours = 0, mins = 0) => new Date(Date.now() - (days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + mins * 60 * 1000));
const future = (days, hours = 0, mins = 0) => new Date(Date.now() + (days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + mins * 60 * 1000));

const physicsTopics = [
  {
    title: "Kinematics & Vector Algebra Assessment",
    topic: "Kinematics & Vectors",
    qCount: 28,
    concepts: ["Projectile Motion on Inclined Plane", "Relative Velocity in 2D", "Rain-Man & River-Boat Problems", "Equations of Motion with Variable Acceleration"]
  },
  {
    title: "Newton's Laws of Motion & Constraint Relations",
    topic: "Newton's Laws",
    qCount: 25,
    concepts: ["Friction on Double Inclined Planes", "Pulleys with Movable Wedges", "Pseudo Force in Rotating Frames", "Block-on-Block Friction Coefficients"]
  },
  {
    title: "Work, Power & Energy Challenge",
    topic: "Work Power Energy",
    qCount: 30,
    concepts: ["Conservative Forces & Potential Energy Curves", "Work-Energy Theorem with Friction", "Vertical Circular Motion Critical Velocities", "Elastic & Inelastic Collisions in 2D"]
  },
  {
    title: "Rotational Dynamics & Torque Test",
    topic: "Rotational Mechanics",
    qCount: 32,
    concepts: ["Moment of Inertia of Continuous Bodies", "Torque and Angular Acceleration Equations", "Angular Momentum Conservation in Collisions", "Rolling Without Slipping Dynamics"]
  },
  {
    title: "Gravitation & Planetary Orbits Assessment",
    topic: "Gravitation",
    qCount: 26,
    concepts: ["Gravitational Potential Energy & Escape Velocity", "Orbital Speeds & Kepler's Third Law", "Variation of Acceleration due to Gravity (g)", "Binding Energy of Binary Star Systems"]
  },
  {
    title: "Thermodynamics & Heat Engine Efficiency",
    topic: "Thermodynamics",
    qCount: 27,
    concepts: ["Carnot Engine Efficiency & Heat Pumps", "First Law of Thermodynamics & PV Diagrams", "Adiabatic vs Isothermal Work Calculations", "Molar Heat Capacities & Degree of Freedom"]
  },
  {
    title: "Electrostatics & Gauss's Flux Law Exam",
    topic: "Electrostatics",
    qCount: 29,
    concepts: ["Electric Field of Ring and Disk Charge Distribution", "Electrostatic Potential Energy & Self-Energy", "Gauss's Law flux through Cubes and Spheres", "Parallel Plate Capacitors with Dielectrics"]
  },
  {
    title: "Current Electricity & Network Circuits Analysis",
    topic: "Current Electricity",
    qCount: 31,
    concepts: ["Kirchhoff's Laws & Mesh Loop Current Analysis", "Drift Velocity, Mobility & Ohm's Law Derivations", "Potentiometer Sensitivity and Internal Resistance", "Symmetry Reductions in Infinite Resistor Grids"]
  },
  {
    title: "Electromagnetic Induction & Faraday's Flux Laws",
    topic: "Electromagnetic Induction",
    qCount: 25,
    concepts: ["Faraday's Law of Induction & Lenz's Rule", "Motional EMF in Rotating Metallic Rods", "Self and Mutual Inductance of Concentric Coils", "LC Oscillations & Energy Exchange Analysis"]
  },
  {
    title: "Wave Optics & Interference Test",
    topic: "Wave Optics",
    qCount: 30,
    concepts: ["Young's Double Slit Interference Fringe Widths", "Single Slit Diffraction Angular Width Analysis", "Brewster's Law & Polarization Intensities", "Thin Film Interference conditions and colours"]
  }
];

function generateQuestionsForTopic(topicData) {
  const questions = [];
  const { topic, qCount, concepts } = topicData;
  for (let i = 1; i <= qCount; i++) {
    const concept = concepts[(i - 1) % concepts.length];
    const isMcq = i % 5 !== 0; // 80% MCQ, 20% Numeric
    
    if (isMcq) {
      questions.push({
        question: `Question ${i} on ${topic}: Consider a physical system under ${concept} constraints. If the parameters scale by a factor of ${i}, what is the resulting magnitude of the physical field?`,
        questionType: 'mcq',
        options: [
          { text: `${i * 4} N`, isCorrect: true },
          { text: `${i * 2.5} N`, isCorrect: false },
          { text: `${i + 6} N`, isCorrect: false },
          { text: `${i * 1.8} N`, isCorrect: false }
        ],
        explanation: `Detailed derivation for ${topic} - ${concept}: We apply the equations of motion and integrate. This yields a value of exactly ${i * 4} N, corresponding to option A.`,
        points: 4,
        difficulty: i % 3 === 0 ? 'easy' : (i % 3 === 1 ? 'medium' : 'hard'),
        tags: [topic.toLowerCase().replace(/[^a-z]/g, ''), 'mechanics']
      });
    } else {
      questions.push({
        question: `Numerical Question ${i} on ${topic}: Calculate the dimensionless coefficient representing ${concept} when evaluated at a system parameter of ${i} units. (Round your answer to the nearest integer)`,
        questionType: 'numeric',
        numericAnswer: i * 2,
        tolerance: 0,
        explanation: `Detailed derivation for ${topic} - ${concept}: Substituting the variables into the standard formula results in ${i * 2}.`,
        points: 4,
        difficulty: 'medium',
        tags: [topic.toLowerCase().replace(/[^a-z]/g, ''), 'mechanics']
      });
    }
  }
  return questions;
}

function generateAnswersForAttempt(exam, targetPercentage, timeSpent) {
  let totalScore = 0;
  const answers = [];
  const avgTime = Math.round(timeSpent / exam.questions.length);

  for (let idx = 0; idx < exam.questions.length; idx++) {
    const q = exam.questions[idx];
    const points = q.points || 4;

    const isCorrect = Math.random() * 100 < targetPercentage;
    const timeTaken = idx === exam.questions.length - 1
        ? Math.max(5, timeSpent - answers.reduce((sum, a) => sum + a.timeTaken, 0))
        : Math.max(5, Math.round(avgTime * (0.7 + Math.random() * 0.6)));

    const ansObj = {
      questionId: q._id,
      isCorrect: isCorrect,
      pointsEarned: isCorrect ? points : (exam.negativeMarking ? -1 : 0),
      timeTaken: timeTaken,
    };

    let correctOptIdx = 0;
    if (q.questionType === 'mcq' && q.options) {
      correctOptIdx = q.options.findIndex(opt => opt.isCorrect);
      if (correctOptIdx === -1) correctOptIdx = 0;
    }

    ansObj.questionData = {
      question: q.question,
      options: q.options ? q.options.map(opt => ({ text: opt.text })) : [],
      correctOption: q.questionType === 'mcq' ? correctOptIdx : null,
      explanation: q.explanation,
      points: points,
      difficulty: q.difficulty,
      questionType: q.questionType,
      numericAnswer: q.numericAnswer,
      tolerance: q.tolerance,
      pairs: q.pairs || [],
    };

    if (q.questionType === 'mcq') {
      if (isCorrect) {
        ansObj.selectedOption = correctOptIdx;
        ansObj.selectedOptionText = q.options[correctOptIdx].text;
      } else {
        const wrongIndices = [];
        q.options.forEach((opt, oIdx) => {
          if (!opt.isCorrect) wrongIndices.push(oIdx);
        });
        const chosenWrongIdx = wrongIndices.length > 0 ? wrongIndices[Math.floor(Math.random() * wrongIndices.length)] : 0;
        ansObj.selectedOption = chosenWrongIdx;
        ansObj.selectedOptionText = q.options[chosenWrongIdx] ? q.options[chosenWrongIdx].text : 'Incorrect Option';
      }
    } else if (q.questionType === 'numeric') {
      if (isCorrect) {
        ansObj.numericAnswer = q.numericAnswer;
      } else {
        ansObj.numericAnswer = q.numericAnswer + (Math.random() > 0.5 ? 1 : -1);
      }
    } else {
      ansObj.textAnswer = isCorrect ? 'Correct explanation' : 'Incorrect response';
    }

    totalScore += ansObj.pointsEarned;
    answers.push(ansObj);
  }

  return { answers, totalScore };
}

async function seed() {
  try {
    console.log('🔄 Connecting to MongoDB at:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected.');

    // 1. Find Vikram (tutor) & Aarav (student)
    const tutorUser = await User.findOne({ email: 'vikram@apexacademy.in' });
    if (!tutorUser) throw new Error('Vikram tutor user not found.');
    
    const tutorProfile = await Tutor.findOne({ userId: tutorUser._id });
    if (!tutorProfile) throw new Error('Vikram tutor profile not found.');

    const aaravUser = await User.findOne({ email: 'aarav.patel@gmail.com' });
    if (!aaravUser) throw new Error('Aarav student user not found.');

    // Find other students for filling leaderboard
    const otherStudents = await User.find({
      email: { $in: ['diya.sharma@gmail.com', 'ishaan.gupta@gmail.com', 'ananya.reddy@gmail.com', 'tanvi.mishra@gmail.com'] }
    });
    if (otherStudents.length === 0) console.warn('⚠️ No other students found for leaderboard.');

    // 2. Find Course IIT JEE Physics
    const course = await Course.findOne({ createdBy: tutorUser._id, title: /Physics/ });
    if (!course) throw new Error('Physics course owned by Vikram not found.');

    // Find batch
    const batch = await Batch.findOne({ courseId: course._id });
    const batchId = batch ? batch._id : null;
    const instituteId = course.instituteId || null;

    console.log(`📚 Found Physics Course: "${course.title}" (${course._id})`);
    if (batchId) console.log(`🏫 Found Batch: "${batch.name}" (${batchId})`);

    // 3. Clear existing Exams, Attempts, and ReevaluationRequests for this course
    const existingExams = await Exam.find({ courseId: course._id });
    const existingExamIds = existingExams.map(e => e._id);

    console.log(`🗑️  Clearing ${existingExamIds.length} existing Physics exams & associated attempts...`);
    await Exam.deleteMany({ courseId: course._id });
    await ExamAttempt.deleteMany({ examId: { $in: existingExamIds } });
    await ExamReevaluationRequest.deleteMany({ examId: { $in: existingExamIds } });
    console.log('✅ Clearing completed.');

    // 4. Seed 10 new exams
    console.log('🌱 Seeding 10 new Physics exams...');
    const createdExams = [];
    
    // Attempt counts configuration requested:
    // Exam 1: 3 attempts, Exam 2: 2 attempts, Exam 3: 1 attempt, Exam 4: 5 attempts, Exam 5: 3 attempts,
    // Exam 6: 2 attempts, Exam 7: 1 attempt, Exam 8: 4 attempts, Exam 9: 2 attempts, Exam 10: 3 attempts.
    const attemptCounts = [3, 2, 1, 5, 3, 2, 1, 4, 2, 3];

    for (let idx = 0; idx < physicsTopics.length; idx++) {
      const topicData = physicsTopics[idx];
      const questions = generateQuestionsForTopic(topicData);
      const totalMarks = questions.reduce((sum, q) => sum + (q.points || 4), 0);
      
      const exam = await Exam.create({
        courseId: course._id,
        tutorId: tutorProfile._id,
        batchId: batchId,
        instituteId: instituteId,
        audience: {
          scope: 'institute',
          instituteId: instituteId,
          batchIds: batchId ? [batchId] : [],
          studentIds: []
        },
        title: topicData.title,
        description: `Advanced evaluations on the topic of ${topicData.topic}. Includes multiple choice and numerical answer types.`,
        type: idx % 3 === 0 ? 'assessment' : (idx % 3 === 1 ? 'midterm' : 'practice'),
        instructions: 'Please complete all questions. Ensure camera and microphone proctoring is functional if prompted.',
        duration: topicData.qCount * 2, // 2 mins per question
        passingMarks: Math.round(totalMarks * 0.4),
        passingPercentage: 40,
        negativeMarking: true,
        isProctoringEnabled: idx % 2 === 0,
        isAudioProctoringEnabled: idx % 4 === 0,
        strictTabSwitching: idx % 3 === 0,
        shuffleQuestions: true,
        shuffleOptions: true,
        showResultImmediately: idx !== 4 && idx !== 8, // Set Exam 5 (idx 4) and Exam 9 (idx 8) as showResultImmediately: false (🔒 locked result)
        showCorrectAnswers: idx !== 4 && idx !== 8,
        allowRetake: attemptCounts[idx] > 1,
        maxAttempts: attemptCounts[idx] + 2, // allow some headroom for additional retakes if they wish
        startDate: ago(15),
        endDate: future(30),
        isScheduled: true,
        status: 'published',
        isPublished: true,
        questions: questions
      });

      createdExams.push(exam);
      console.log(`   [${idx + 1}/10] Created Exam: "${exam.title}" (${questions.length} questions, Total Marks: ${totalMarks})`);
    }

    // 5. Seed Attempts
    console.log('\n🏃 Seeding human-like exam attempts for Aarav and other students...');
    
    for (let idx = 0; idx < createdExams.length; idx++) {
      const exam = createdExams[idx];
      const maxAaravAttempts = attemptCounts[idx];
      const totalMarks = exam.questions.reduce((sum, q) => sum + (q.points || 4), 0);

      // A. Seed Aarav's attempts (ascending order of attempts)
      const aaravAttempts = [];
      for (let attemptNum = 1; attemptNum <= maxAaravAttempts; attemptNum++) {
        // Aarav starts poor and gets progressively better!
        let targetPercentage;
        if (maxAaravAttempts === 1) targetPercentage = 82; // single attempt is solid
        else {
          targetPercentage = 45 + ((attemptNum - 1) / (maxAaravAttempts - 1)) * 48; // scales from 45% up to 93%
        }
        
        const timeSpent = Math.round((exam.duration * 60) * (0.45 + (attemptNum * 0.1) + Math.random() * 0.1)); // e.g. 50% to 90% of exam duration
        const attemptResult = generateAnswersForAttempt(exam, targetPercentage, timeSpent);
        
        const score = Math.max(0, attemptResult.totalScore);
        const percentage = Math.round((score / totalMarks) * 100);

        const attempt = await ExamAttempt.create({
          examId: exam._id,
          studentId: aaravUser._id,
          courseId: course._id,
          attemptNumber: attemptNum,
          answers: attemptResult.answers,
          score: score,
          percentage: percentage,
          isPassed: score >= exam.passingMarks,
          timeSpent: timeSpent,
          startedAt: ago(10 - attemptNum, 2, 0),
          submittedAt: ago(10 - attemptNum, 2 - Math.floor(timeSpent / 3600), Math.floor((timeSpent % 3600) / 60)),
          tabSwitchCount: attemptNum === 1 ? 2 : 0,
          proctoringEvents: attemptNum === 1 ? [
            { eventType: 'tab_switch', severity: 'low', details: 'Accidental browser defocus detected', timestamp: ago(10 - attemptNum, 2, 10) }
          ] : [],
          aiRiskScore: attemptNum === 1 ? 1.5 : 0,
          aiRiskLevel: 'Safe'
        });

        aaravAttempts.push(attempt);
      }
      console.log(`   💪 Seeded ${maxAaravAttempts} attempts for Aarav Patel on "${exam.title}"`);

      // B. Seed other students' attempts so leaderboard has valid comparison
      const studentAttemptScores = [];
      for (const student of otherStudents) {
        // Seed 1 attempt per student with randomized human-like performance
        const targetPercentage = 50 + Math.random() * 40; // 50% to 90%
        const timeSpent = Math.round((exam.duration * 60) * (0.5 + Math.random() * 0.3));
        const attemptResult = generateAnswersForAttempt(exam, targetPercentage, timeSpent);
        const score = Math.max(0, attemptResult.totalScore);
        const percentage = Math.round((score / totalMarks) * 100);

        const attempt = await ExamAttempt.create({
          examId: exam._id,
          studentId: student._id,
          courseId: course._id,
          attemptNumber: 1,
          answers: attemptResult.answers,
          score: score,
          percentage: percentage,
          isPassed: score >= exam.passingMarks,
          timeSpent: timeSpent,
          startedAt: ago(8, 4, 0),
          submittedAt: ago(8, 4 - Math.floor(timeSpent / 3600), Math.floor((timeSpent % 3600) / 60)),
          tabSwitchCount: 0,
          proctoringEvents: [],
          aiRiskScore: 0,
          aiRiskLevel: 'Safe'
        });

        studentAttemptScores.push(attempt);
      }

      // C. Post-processing: Calculate and save Percentiles for all attempts of this exam
      const allAttempts = await ExamAttempt.find({ examId: exam._id });
      const scores = allAttempts.map(a => a.score).sort((a, b) => a - b);
      
      let totalPassed = 0;
      let totalScoresSum = 0;

      for (const att of allAttempts) {
        const countBelow = scores.filter(s => s < att.score).length;
        const countSame = scores.filter(s => s === att.score).length;
        const pct = ((countBelow + 0.5 * countSame) / allAttempts.length) * 100;
        
        att.percentile = Math.round(pct * 10) / 10;
        await att.save();

        if (att.isPassed) totalPassed++;
        totalScoresSum += att.score;
      }

      // Update statistics on the Exam
      const avgScore = Math.round(totalScoresSum / allAttempts.length);
      await Exam.findByIdAndUpdate(exam._id, {
        attemptCount: allAttempts.length,
        averageScore: avgScore
      });
      console.log(`   🏆 Leaderboard populated with ${allAttempts.length} total participants for "${exam.title}" (Average Score: ${avgScore})`);
    }

    // 6. Seed Re-evaluation Requests
    console.log('\n📝 Seeding Custom Exam Re-evaluation Requests...');
    
    // Request A: Exam 1 (Work Power Energy) - Approved re-evaluation
    const exam1 = createdExams[0];
    const aaravExam1Attempt1 = await ExamAttempt.findOne({ examId: exam1._id, studentId: aaravUser._id, attemptNumber: 1 });
    if (aaravExam1Attempt1) {
      await ExamReevaluationRequest.create({
        attemptId: aaravExam1Attempt1._id,
        examId: exam1._id,
        courseId: course._id,
        studentId: aaravUser._id,
        tutorId: tutorProfile._id,
        status: 'approved',
        reason: 'I believe Question 10 (numerical) was evaluated incorrectly. I entered 20 which is correct, but got marked incorrect. Please review the tolerance parameters.',
        originalScore: aaravExam1Attempt1.score,
        originalPercentage: aaravExam1Attempt1.percentage,
        originalPassed: aaravExam1Attempt1.isPassed,
        revisedScore: aaravExam1Attempt1.score + 4,
        revisedPercentage: Math.round(((aaravExam1Attempt1.score + 4) / exam1.questions.reduce((sum, q) => sum + (q.points || 4), 0)) * 100),
        revisedPassed: true,
        tutorRemarks: 'Checked your numerical submission. There was indeed a tolerance issue on rounding parameters. Awarded full +4 marks.',
        reviewedBy: tutorUser._id,
        reviewedAt: ago(1)
      });
      console.log(`   ✅ Seeded APPROVED re-evaluation request for Aarav Patel on "${exam1.title}"`);
    }

    // Request B: Exam 4 (Rotational Dynamics) - Rejected re-evaluation
    const exam4 = createdExams[3];
    const aaravExam4Attempt1 = await ExamAttempt.findOne({ examId: exam4._id, studentId: aaravUser._id, attemptNumber: 1 });
    if (aaravExam4Attempt1) {
      await ExamReevaluationRequest.create({
        attemptId: aaravExam4Attempt1._id,
        examId: exam4._id,
        courseId: course._id,
        studentId: aaravUser._id,
        tutorId: tutorProfile._id,
        status: 'rejected',
        reason: 'In Question 12, Option A and Option C are extremely similar due to typo in formula symbols. I selected Option C which is technically equivalent. Kindly award marks.',
        originalScore: aaravExam4Attempt1.score,
        originalPercentage: aaravExam4Attempt1.percentage,
        originalPassed: aaravExam4Attempt1.isPassed,
        tutorRemarks: 'Option A uses the derivative form directly while Option C is the simplified constant case, which is not applicable under the variable force constraint given. The original evaluation stands.',
        reviewedBy: tutorUser._id,
        reviewedAt: ago(2)
      });
      console.log(`   ✅ Seeded REJECTED re-evaluation request for Aarav Patel on "${exam4.title}"`);
    }

    // Request C: Exam 8 (Current Electricity) - Pending re-evaluation
    const exam8 = createdExams[7];
    const aaravExam8Attempt1 = await ExamAttempt.findOne({ examId: exam8._id, studentId: aaravUser._id, attemptNumber: 1 });
    if (aaravExam8Attempt1) {
      await ExamReevaluationRequest.create({
        attemptId: aaravExam8Attempt1._id,
        examId: exam8._id,
        courseId: course._id,
        studentId: aaravUser._id,
        tutorId: tutorProfile._id,
        status: 'pending',
        reason: 'Question 15 (MCQ) option keys are misaligned. The option containing Kirchhoff Loop equations is Option B, but the system key says Option A is correct. Please manually verify this question.'
      });
      console.log(`   ✅ Seeded PENDING re-evaluation request for Aarav Patel on "${exam8.title}"`);
    }

    console.log('\n🎉 Human-like Physics Exam & Attempts Seeding completed successfully!');
    await mongoose.disconnect();
    console.log('🔄 Disconnected from MongoDB.');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    try { await mongoose.disconnect(); } catch (_) {}
  }
}

seed();
