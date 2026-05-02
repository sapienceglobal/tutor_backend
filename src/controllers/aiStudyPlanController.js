import { createNotification } from './notificationController.js';
// @desc    Generate AI Study Plan
// @route   POST /api/ai/generate-study-plan
export const studentGnerateStudyPlan = async (req, res) => {
    try {
        const { performanceData, courses, goals } = req.body;

        if (!performanceData || !courses) {
            return res.status(400).json({
                success: false,
                message: 'Performance data and courses are required'
            });
        }

        // 1. Analyze Performance Data
        const performanceAnalysis = analyzePerformance(performanceData);

        // 2. Generate Study Plan
        const studyPlan = generatePersonalizedStudyPlan(performanceAnalysis, courses, goals);

        // 3. Save Study Plan (optional - for future reference)
        // await saveStudyPlan(req.user.id, studyPlan);

        // 4. Create notification
        await createNotification({
            userId: req.user.id,
            type: 'study_plan_generated',
            title: 'AI Study Plan Generated!',
            message: `Your personalized study plan is ready with focus on ${studyPlan.focusAreas?.length || 0} key areas.`,
            data: { studyPlan }
        });

        res.status(200).json({
            success: true,
            message: 'AI Study Plan generated successfully',
            studyPlan
        });

    } catch (error) {
        console.error('Generate AI Study Plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate AI study plan'
        });
    }
};

// Helper function to analyze performance
function analyzePerformance(performanceData) {
    if (!performanceData.length) {
        return {
            avgScore: 0,
            strongSubjects: [],
            weakSubjects: [],
            trends: 'stable',
            improvementRate: 0
        };
    }

    const scores = performanceData.map(p => p.totalMarks > 0 ? (p.score / p.totalMarks) * 100 : 0);
    const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);

    // Identify strong and weak areas
    const subjectPerformance = {};
    performanceData.forEach(attempt => {
        const subject = attempt.examTitle || 'General';
        if (!subjectPerformance[subject]) {
            subjectPerformance[subject] = [];
        }
        subjectPerformance[subject].push(attempt.totalMarks > 0 ? (attempt.score / attempt.totalMarks) * 100 : 0);
    });

    const strongSubjects = [];
    const weakSubjects = [];

    Object.entries(subjectPerformance).forEach(([subject, scores]) => {
        const subjectAvg = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        if (subjectAvg >= 80) {
            strongSubjects.push(subject);
        } else if (subjectAvg < 60) {
            weakSubjects.push(subject);
        }
    });

    // Calculate trend
    const recentScores = scores.slice(-5);
    const olderScores = scores.slice(0, -5);
    const recentAvg = recentScores.length > 0 ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length : 0;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length : 0;
    const trend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';

    return {
        avgScore,
        strongSubjects,
        weakSubjects,
        trends: trend,
        improvementRate: Math.round(((recentAvg - olderAvg) / olderAvg) * 100) || 0
    };
}

// Helper function to generate personalized study plan
function generatePersonalizedStudyPlan(performanceAnalysis, courses, goals) {
    const { avgScore, strongSubjects, weakSubjects, trends } = performanceAnalysis;

    // Determine study duration based on performance
    let duration = '4 weeks';
    let dailyGoal = '2 hours';

    if (avgScore < 60) {
        duration = '6 weeks';
        dailyGoal = '3 hours';
    } else if (avgScore >= 80) {
        duration = '3 weeks';
        dailyGoal = '1.5 hours';
    }

    // Generate focus areas
    const focusAreas = [];

    // Add weak subjects as high priority
    weakSubjects.forEach(subject => {
        focusAreas.push({
            area: subject,
            priority: 'High',
            reason: 'Needs significant improvement'
        });
    });

    // Add some strong subjects for maintenance
    strongSubjects.slice(0, 2).forEach(subject => {
        focusAreas.push({
            area: subject,
            priority: 'Medium',
            reason: 'Maintain current performance'
        });
    });

    // Add general areas if needed
    if (focusAreas.length < 3) {
        focusAreas.push({
            area: 'Time Management',
            priority: 'High',
            reason: 'Improve test-taking speed'
        });
    }

    // Generate weekly schedule
    const weeklySchedule = {
        Monday: 'Review weak areas & practice problems',
        Tuesday: 'Study new concepts & take practice test',
        Wednesday: 'Focus on strong subjects & advanced topics',
        Thursday: 'Group study & discussion',
        Friday: 'Full practice test & review mistakes',
        Saturday: 'Light review & prepare for next week',
        Sunday: 'Rest & light reading'
    };

    // Generate recommendations
    const recommendations = [
        `Focus on ${weakSubjects.length > 0 ? weakSubjects.join(', ') : 'problem areas'} for 30 minutes daily`,
        'Take timed practice tests to improve speed',
        'Review mistakes and create error log',
        'Study in focused 25-minute sessions with 5-minute breaks',
        'Use active recall techniques for better retention',
        'Practice with past papers under exam conditions'
    ];

    // Calculate expected improvement
    const expectedImprovement = trends === 'declining' ? '+25%' :
        trends === 'stable' ? '+15%' : '+10%';

    return {
        duration,
        dailyGoal,
        focusAreas,
        weeklySchedule,
        recommendations,
        expectedImprovement,
        generatedAt: new Date(),
        performanceAnalysis
    };
}

// @desc    Get AI Quick Recommendations
// @route   GET /api/ai/quick-recommendations
// @access  Private (Student)
import mongoose from 'mongoose';
export const getQuickRecommendations = async (req, res) => {
    try {
        const { ExamAttempt } = await import('../models/Exam.js');
        const recentAttempts = await ExamAttempt.find({ studentId: req.user.id })
            .populate('examId', 'title')
            .sort({ createdAt: -1 })
            .limit(5);

        if (!recentAttempts || recentAttempts.length === 0) {
            return res.status(200).json({
                success: true,
                recommendations: [
                    "Welcome! Take your first exam to get personalized AI recommendations.",
                    "Explore the Discover tab to find courses that match your interests.",
                    "Set up a daily study schedule to build consistent habits."
                ]
            });
        }

        // Map data for analyzePerformance. Handle case where totalMarks may be missing or inside examId
        const performanceData = recentAttempts.map(attempt => {
            return {
                examTitle: attempt.examId ? attempt.examId.title : 'General Quiz',
                score: attempt.score || 0,
                totalMarks: attempt.totalMarks || (attempt.score ? attempt.score + (attempt.incorrectCount || 0) : 100) // Rough fallback
            };
        });

        const analysis = analyzePerformance(performanceData);
        let dynamicRecommendations = [];

        if (analysis.weakSubjects.length > 0) {
            dynamicRecommendations.push(`Focus on ${analysis.weakSubjects.join(', ')} for 30 minutes daily to improve weak areas.`);
            dynamicRecommendations.push(`Review mistakes from your recent ${analysis.weakSubjects[0]} tests and create an error log.`);
        } else if (analysis.strongSubjects.length > 0) {
            dynamicRecommendations.push(`Great job on ${analysis.strongSubjects[0]}! Keep up the momentum with advanced practice.`);
            dynamicRecommendations.push(`Try to maintain consistency across all subjects to achieve a balanced score profile.`);
        }

        if (analysis.trends === 'declining') {
            dynamicRecommendations.push("Your recent scores show a slight dip. Try studying in focused 25-minute sessions with 5-minute breaks.");
        } else if (analysis.trends === 'improving') {
            dynamicRecommendations.push("You're on an upward trend! Challenge yourself with timed practice tests to improve speed.");
        } else {
            dynamicRecommendations.push("Your performance is stable. Use active recall techniques to push your scores higher.");
        }

        // Just take top 3
        const finalRecommendations = dynamicRecommendations.slice(0, 3);

        res.status(200).json({
            success: true,
            recommendations: finalRecommendations
        });

    } catch (error) {
        console.error('Get quick recommendations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate recommendations'
        });
    }
};
