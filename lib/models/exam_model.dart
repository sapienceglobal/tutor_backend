class ExamQuestion {
  final String id;
  final String question;
  final List<ExamOption> options;
  final String? explanation;
  final int points;
  final String difficulty;
  final List<String> tags;

  ExamQuestion({
    required this.id,
    required this.question,
    required this.options,
    this.explanation,
    this.points = 1,
    this.difficulty = 'medium',
    this.tags = const [],
  });

  factory ExamQuestion.fromJson(Map<String, dynamic> json) {
    return ExamQuestion(
      id: json['_id'] ?? '',
      question: json['question'] ?? '',
      options:
          (json['options'] as List?)
              ?.map((o) => ExamOption.fromJson(o))
              .toList() ??
          [],
      explanation: json['explanation'],
      points: json['points'] ?? 1,
      difficulty: json['difficulty'] ?? 'medium',
      tags: (json['tags'] as List?)?.map((t) => t.toString()).toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{
      'question': question,
      'options': options.map((o) => o.toJson()).toList(),
      'points': points,
      'difficulty': difficulty,
      'tags': tags,
    };

    // Only include _id if it's not empty (for updates)
    if (id.isNotEmpty) {
      json['_id'] = id;
    }

    if (explanation != null && explanation!.isNotEmpty) {
      json['explanation'] = explanation;
    }

    return json;
  }
}

class ExamOption {
  final String text;
  final bool isCorrect;

  ExamOption({required this.text, this.isCorrect = false});

  factory ExamOption.fromJson(Map<String, dynamic> json) {
    return ExamOption(
      text: json['text'] ?? '',
      isCorrect: json['isCorrect'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {'text': text, 'isCorrect': isCorrect};
}

class ExamModel {
  final String id;
  final String courseId;
  final String tutorId;
  final String title;
  final String description;
  final String type;
  final String? instructions;
  final int duration; // minutes
  final int totalMarks;
  final int passingMarks;
  final int passingPercentage;
  final List<ExamQuestion> questions;
  final int totalQuestions;

  // Settings
  final bool shuffleQuestions;
  final bool shuffleOptions;
  final bool showResultImmediately;
  final bool showCorrectAnswers;
  final bool allowRetake;
  final int maxAttempts;

  // Scheduling
  final DateTime? startDate;
  final DateTime? endDate;
  final bool isScheduled;

  // Status
  final String status;
  final bool isPublished;

  // Stats & AI
  final int attemptCount; // Now represents Student's attempt count from backend
  final double averageScore;
  final bool isAIGenerated;
  final String? aiPrompt;
  final DateTime createdAt;
  final DateTime updatedAt;

  // ---------------------------------------------------------------------------
  // NEW FIELD: To store the student's last attempt result (Score, Pass/Fail)
  // ---------------------------------------------------------------------------
  final Map<String, dynamic>? lastAttempt;

  ExamModel({
    required this.id,
    required this.courseId,
    required this.tutorId,
    required this.title,
    this.description = '',
    this.type = 'assessment',
    this.instructions,
    required this.duration,
    required this.totalMarks,
    required this.passingMarks,
    this.passingPercentage = 70,
    this.questions = const [],
    this.totalQuestions = 0,
    this.shuffleQuestions = false,
    this.shuffleOptions = false,
    this.showResultImmediately = false,
    this.showCorrectAnswers = true,
    this.allowRetake = false,
    this.maxAttempts = 1,
    this.startDate,
    this.endDate,
    this.isScheduled = false,
    this.status = 'draft',
    this.isPublished = false,
    this.attemptCount = 0,
    this.averageScore = 0.0,
    this.isAIGenerated = false,
    this.aiPrompt,
    required this.createdAt,
    required this.updatedAt,

    // NEW Constructor Argument
    this.lastAttempt,
  });

  factory ExamModel.fromJson(Map<String, dynamic> json) {
    return ExamModel(
      id: json['_id'] ?? '',
      courseId: json['courseId'] ?? '',
      tutorId: json['tutorId'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'assessment',
      instructions: json['instructions'],
      duration: json['duration'] ?? 0,
      totalMarks: json['totalMarks'] ?? 0,
      passingMarks: json['passingMarks'] ?? 0,
      passingPercentage: json['passingPercentage'] ?? 70,
      questions:
          (json['questions'] as List?)
              ?.map((q) => ExamQuestion.fromJson(q))
              .toList() ??
          [],
      totalQuestions: json['totalQuestions'] ?? 0,
      shuffleQuestions: json['shuffleQuestions'] ?? false,
      shuffleOptions: json['shuffleOptions'] ?? false,
      showResultImmediately: json['showResultImmediately'] ?? false,
      showCorrectAnswers: json['showCorrectAnswers'] ?? true,
      allowRetake: json['allowRetake'] ?? false,
      maxAttempts: json['maxAttempts'] ?? 1,
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'])
          : null,
      endDate: json['endDate'] != null ? DateTime.parse(json['endDate']) : null,
      isScheduled: json['isScheduled'] ?? false,
      status: json['status'] ?? 'draft',
      isPublished: json['isPublished'] ?? false,

      // Existing field, but logic is updated in backend to send student specific count
      attemptCount: json['attemptCount'] ?? 0,

      averageScore: (json['averageScore'] ?? 0).toDouble(),
      isAIGenerated: json['isAIGenerated'] ?? false,
      aiPrompt: json['aiPrompt'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'])
          : DateTime.now(),

      // NEW Mapping
      lastAttempt: json['lastAttempt'],
    );
  }

  // ---------------------------------------------------------------------------
  // NEW LOGIC GETTERS (Safe to add, won't break existing code)
  // These help the UI decide whether to show "Start Exam" or "Locked"
  // ---------------------------------------------------------------------------

  bool get canTakeExam {
    if (isDateRestricted) return false;
    if (attemptCount == 0) return true;
    if (!allowRetake && attemptCount > 0) return false;
    if (maxAttempts > 0 && attemptCount >= maxAttempts) return false;
    return true;
  }

  bool get isDateRestricted {
    if (!isScheduled) return false;
    final now = DateTime.now();
    if (startDate != null && now.isBefore(startDate!)) return true;
    if (endDate != null && now.isAfter(endDate!)) return true;
    return false;
  }

  String get dateStatusText {
    if (!isScheduled) return '';
    final now = DateTime.now();
    if (startDate != null && now.isBefore(startDate!)) {
      return 'Opens: ${_formatDate(startDate!)}';
    }
    if (endDate != null && now.isAfter(endDate!)) {
      return 'Expired: ${_formatDate(endDate!)}';
    }
    if (endDate != null) {
      return 'Due: ${_formatDate(endDate!)}';
    }
    return '';
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  // ---------------------------------------------------------------------------

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'courseId': courseId,
      'tutorId': tutorId,
      'title': title,
      'description': description,
      'type': type,
      'instructions': instructions,
      'duration': duration,
      'totalMarks': totalMarks,
      'passingMarks': passingMarks,
      'passingPercentage': passingPercentage,
      'questions': questions.map((q) => q.toJson()).toList(),
      'totalQuestions': totalQuestions,
      'shuffleQuestions': shuffleQuestions,
      'shuffleOptions': shuffleOptions,
      'showResultImmediately': showResultImmediately,
      'showCorrectAnswers': showCorrectAnswers,
      'allowRetake': allowRetake,
      'maxAttempts': maxAttempts,
      'startDate': startDate?.toIso8601String(),
      'endDate': endDate?.toIso8601String(),
      'isScheduled': isScheduled,
      'status': status,
      'isPublished': isPublished,
      'attemptCount': attemptCount,
      'averageScore': averageScore,
      'isAIGenerated': isAIGenerated,
      'aiPrompt': aiPrompt,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      // Optional: Include lastAttempt in toJson if needed for caching
      'lastAttempt': lastAttempt,
    };
  }
}

// ... ExamAttempt and AttemptAnswer classes remain EXACTLY SAME ...
class ExamAttempt {
  final String id;
  final String examId;
  final String studentId;
  final String courseId;
  final int attemptNumber;
  final List<AttemptAnswer> answers;
  final int score;
  final int percentage;
  final bool isPassed;
  final int timeSpent;
  final DateTime startedAt;
  final DateTime submittedAt;

  ExamAttempt({
    required this.id,
    required this.examId,
    required this.studentId,
    required this.courseId,
    required this.attemptNumber,
    required this.answers,
    required this.score,
    required this.percentage,
    required this.isPassed,
    required this.timeSpent,
    required this.startedAt,
    required this.submittedAt,
  });

  factory ExamAttempt.fromJson(Map<String, dynamic> json) {
    return ExamAttempt(
      id: json['_id'] ?? '',
      examId: json['examId'] ?? '',
      studentId: json['studentId'] ?? '',
      courseId: json['courseId'] ?? '',
      attemptNumber: json['attemptNumber'] ?? 1,
      answers:
          (json['answers'] as List?)
              ?.map((a) => AttemptAnswer.fromJson(a))
              .toList() ??
          [],
      score: json['score'] ?? 0,
      percentage: json['percentage'] ?? 0,
      isPassed: json['isPassed'] ?? false,
      timeSpent: json['timeSpent'] ?? 0,
      startedAt: DateTime.parse(json['startedAt']),
      submittedAt: DateTime.parse(json['submittedAt']),
    );
  }
}

class AttemptAnswer {
  final String questionId;
  final int selectedOption;
  final bool isCorrect;
  final int pointsEarned;

  AttemptAnswer({
    required this.questionId,
    required this.selectedOption,
    required this.isCorrect,
    required this.pointsEarned,
  });

  factory AttemptAnswer.fromJson(Map<String, dynamic> json) {
    return AttemptAnswer(
      questionId: json['questionId'] ?? '',
      selectedOption: json['selectedOption'] ?? 0,
      isCorrect: json['isCorrect'] ?? false,
      pointsEarned: json['pointsEarned'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'questionId': questionId,
      'selectedOption': selectedOption,
      'isCorrect': isCorrect,
      'pointsEarned': pointsEarned,
    };
  }
}
