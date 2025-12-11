class QuizData {
  List<QuizQuestion> questions;
  int passingScore;

  QuizData({
    required this.questions,
    this.passingScore = 70,
  });

  // ✅ Original toJson (with _id)
  Map<String, dynamic> toJson() {
    return {
      'questions': questions.map((q) => q.toJson()).toList(),
      'passingScore': passingScore,
    };
  }

  // ✅ NEW: Clean toJson (without _id) for backend
  Map<String, dynamic> toJsonClean() {
    return {
      'questions': questions.map((q) => q.toJsonClean()).toList(),
      'passingScore': passingScore,
    };
  }
}

class QuizQuestion {
  String? id; // Keep for local state management
  String question;
  String type;
  List<QuizOption> options;
  String? correctAnswer;
  int points;

  QuizQuestion({
    this.id,
    required this.question,
    this.type = 'multiple-choice',
    required this.options,
    this.correctAnswer,
    this.points = 1,
  });

  Map<String, dynamic> toJson() {
    return {
      if (id != null) '_id': id,
      'question': question,
      'type': type,
      'options': options.map((o) => o.toJson()).toList(),
      if (correctAnswer != null) 'correctAnswer': correctAnswer,
      'points': points,
    };
  }

  // ✅ NEW: Clean version without _id
  Map<String, dynamic> toJsonClean() {
    return {
      'question': question,
      'type': type,
      'options': options.map((o) => o.toJsonClean()).toList(),
      if (correctAnswer != null) 'correctAnswer': correctAnswer,
      'points': points,
    };
  }

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['_id'],
      question: json['question'] ?? '',
      type: json['type'] ?? 'multiple-choice',
      options: (json['options'] as List?)
              ?.map((o) => QuizOption.fromJson(o))
              .toList() ??
          [],
      correctAnswer: json['correctAnswer'],
      points: json['points'] ?? 1,
    );
  }
}

class QuizOption {
  String? id; // Keep for local state management
  String text;
  bool isCorrect;

  QuizOption({
    this.id,
    required this.text,
    this.isCorrect = false,
  });

  Map<String, dynamic> toJson() {
    return {
      if (id != null) '_id': id,
      'text': text,
      'isCorrect': isCorrect,
    };
  }

  // ✅ NEW: Clean version without _id
  Map<String, dynamic> toJsonClean() {
    return {
      'text': text,
      'isCorrect': isCorrect,
    };
  }

  factory QuizOption.fromJson(Map<String, dynamic> json) {
    return QuizOption(
      id: json['_id'],
      text: json['text'] ?? '',
      isCorrect: json['isCorrect'] ?? false,
    );
  }
}