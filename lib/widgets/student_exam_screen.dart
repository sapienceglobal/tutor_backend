import 'package:flutter/material.dart';
import 'dart:async';
import '../../models/exam_model.dart';
import '../../services/exam_service.dart';
import '../../utils/constants.dart';

class StudentExamScreen extends StatefulWidget {
  final ExamModel exam;
  final String courseId;

  const StudentExamScreen({
    super.key,
    required this.exam,
    required this.courseId,
  });

  @override
  State<StudentExamScreen> createState() => _StudentExamScreenState();
}

class _StudentExamScreenState extends State<StudentExamScreen> {
  Map<String, int> _answers = {}; // questionId -> selectedOptionIndex
  Timer? _timer;
  int _remainingSeconds = 0;
  bool _isSubmitting = false;
  DateTime? _startedAt;
  int _currentQuestionIndex = 0;
  late PageController _pageController;
  List<ExamQuestion> _displayQuestions = [];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
    _initializeExam();
  }

  void _initializeExam() {
    _startedAt = DateTime.now();

    // Shuffle questions if needed
    _displayQuestions = List.from(widget.exam.questions);
    if (widget.exam.shuffleQuestions) {
      _displayQuestions.shuffle();
    }

    // Shuffle options if needed
    if (widget.exam.shuffleOptions) {
      // Note: This changes option indices, need to track original
      // For simplicity, not implementing full shuffle here
    }

    // Start timer
    _remainingSeconds = widget.exam.duration * 60;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() => _remainingSeconds--);
      } else {
        _autoSubmit();
      }
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  String _formatTime(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_currentQuestionIndex + 1) / _displayQuestions.length;

    return WillPopScope(
      onWillPop: () async {
        final shouldExit = await _confirmExit();
        return shouldExit ?? false;
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.exam.title),
          centerTitle: true,
          actions: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(right: 16),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: _remainingSeconds < 300
                      ? Colors.red.withOpacity(0.1)
                      : Colors.blue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.timer,
                      size: 16,
                      color: _remainingSeconds < 300 ? Colors.red : Colors.blue,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _formatTime(_remainingSeconds),
                      style: TextStyle(
                        color: _remainingSeconds < 300
                            ? Colors.red
                            : Colors.blue,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        body: _isSubmitting
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  _buildProgressBar(progress),
                  Expanded(
                    child: PageView.builder(
                      controller: _pageController,
                      onPageChanged: (index) =>
                          setState(() => _currentQuestionIndex = index),
                      itemCount: _displayQuestions.length,
                      itemBuilder: (context, index) {
                        return _buildQuestionPage(
                          _displayQuestions[index],
                          index,
                        );
                      },
                    ),
                  ),
                  _buildBottomNavigation(),
                ],
              ),
      ),
    );
  }

  Widget _buildProgressBar(double progress) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.grey[100],
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Question ${_currentQuestionIndex + 1} of ${_displayQuestions.length}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              Text(
                '${_answers.length}/${_displayQuestions.length} answered',
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: progress,
            backgroundColor: Colors.grey[300],
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionPage(ExamQuestion question, int index) {
    final questionNumber = index + 1;
    final hasAnswer = _answers.containsKey(question.id);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Question
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.blue[50],
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blue[200]!),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Q$questionNumber',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        question.question,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.orange.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              question.difficulty.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.orange[800],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${question.points} ${question.points == 1 ? 'point' : 'points'}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[700],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Options
          const Text(
            'Choose one answer:',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 12),

          ...question.options.asMap().entries.map((entry) {
            final optionIndex = entry.key;
            final option = entry.value;
            final isSelected = _answers[question.id] == optionIndex;

            return GestureDetector(
              onTap: () => _selectAnswer(question.id, optionIndex),
              child: Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary.withOpacity(0.1)
                      : Colors.white,
                  border: Border.all(
                    color: isSelected ? AppColors.primary : Colors.grey[300]!,
                    width: isSelected ? 2 : 1,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isSelected ? AppColors.primary : Colors.white,
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : Colors.grey[400]!,
                          width: 2,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          String.fromCharCode(65 + optionIndex),
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.grey[600],
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        option.text,
                        style: TextStyle(
                          fontSize: 15,
                          color: isSelected
                              ? AppColors.primary
                              : Colors.black87,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.normal,
                        ),
                      ),
                    ),
                    if (isSelected)
                      Icon(
                        Icons.check_circle,
                        color: AppColors.primary,
                        size: 24,
                      ),
                  ],
                ),
              ),
            );
          }),

          const SizedBox(height: 24),

          // Status indicator
          if (hasAnswer)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: Colors.green, size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Answer saved',
                    style: TextStyle(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBottomNavigation() {
    final isLastQuestion =
        _currentQuestionIndex == _displayQuestions.length - 1;
    final canGoBack = _currentQuestionIndex > 0;
    final allAnswered = _answers.length == _displayQuestions.length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.2),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          if (canGoBack)
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () {
                  _pageController.previousPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                  );
                },
                icon: const Icon(Icons.arrow_back),
                label: const Text('Previous'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          if (canGoBack) const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton.icon(
              onPressed: isLastQuestion
                  ? (allAnswered ? _showSubmitConfirmation : null)
                  : () {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    },
              icon: Icon(isLastQuestion ? Icons.check : Icons.arrow_forward),
              label: Text(isLastQuestion ? 'Submit Exam' : 'Next'),
              style: ElevatedButton.styleFrom(
                backgroundColor: isLastQuestion
                    ? Colors.green
                    : AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                disabledBackgroundColor: Colors.grey[300],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _selectAnswer(String questionId, int optionIndex) {
    setState(() {
      _answers[questionId] = optionIndex;
    });
  }

  Future<void> _showSubmitConfirmation() async {
    final unanswered = _displayQuestions.length - _answers.length;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit Exam?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Total Questions: ${_displayQuestions.length}'),
            Text('Answered: ${_answers.length}'),
            if (unanswered > 0)
              Text(
                'Unanswered: $unanswered',
                style: const TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
            const SizedBox(height: 16),
            const Text(
              'Once submitted, you cannot change your answers.',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Review'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
            ),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      _submitExam();
    }
  }

  Future<void> _submitExam() async {
    setState(() => _isSubmitting = true);

    try {
      final timeSpent = DateTime.now().difference(_startedAt!).inSeconds;

      // Prepare answers
      final answersData = _displayQuestions.map((question) {
        final selectedOption = _answers[question.id] ?? -1;
        return {'questionId': question.id, 'selectedOption': selectedOption};
      }).toList();

      final response = await ExamService.submitExam(
        examId: widget.exam.id,
        answers: answersData,
        timeSpent: timeSpent,
        startedAt: _startedAt!,
      );

      if (mounted) {
        if (response['success']) {
          _showResults(response['attempt']);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['message'] ?? 'Submission failed'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  void _autoSubmit() {
    _timer?.cancel();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Time is up! Auto-submitting...'),
        backgroundColor: Colors.orange,
      ),
    );
    _submitExam();
  }

  void _showResults(Map<String, dynamic> attemptData) {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) =>
            ExamResultScreen(exam: widget.exam, attemptData: attemptData),
      ),
    );
  }

  Future<bool?> _confirmExit() {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Exit Exam?'),
        content: const Text(
          'Your progress will be lost if you exit now. Are you sure?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Exit'),
          ),
        ],
      ),
    );
  }
}

// Simple Result Screen
class ExamResultScreen extends StatelessWidget {
  final ExamModel exam;
  final Map<String, dynamic> attemptData;

  const ExamResultScreen({
    super.key,
    required this.exam,
    required this.attemptData,
  });

  @override
  Widget build(BuildContext context) {
    final score = attemptData['score'] ?? 0;
    final percentage = attemptData['percentage'] ?? 0;
    final isPassed = attemptData['isPassed'] ?? false;
    final totalMarks = attemptData['totalMarks'] ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Exam Results'),
        automaticallyImplyLeading: false,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isPassed ? Icons.check_circle : Icons.cancel,
                size: 100,
                color: isPassed ? Colors.green : Colors.red,
              ),
              const SizedBox(height: 24),
              Text(
                isPassed ? 'Congratulations!' : 'Better Luck Next Time',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Score: $score / $totalMarks',
                style: const TextStyle(fontSize: 20),
              ),
              Text(
                'Percentage: $percentage%',
                style: TextStyle(
                  fontSize: 18,
                  color: isPassed ? Colors.green : Colors.red,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: () {
                  Navigator.popUntil(context, (route) => route.isFirst);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                ),
                child: const Text('Back to Course'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
