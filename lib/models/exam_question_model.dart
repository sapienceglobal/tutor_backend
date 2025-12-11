class ExamQuestion {
  final String id;
  final String questionText; // Backend me 'question' hai, yaha clarity ke liye questionText
  final List<ExamOption> options;
  final String? explanation;
  final int points;
  final String difficulty;
  final List<String> tags;

  ExamQuestion({
    required this.id,
    required this.questionText,
    required this.options,
    this.explanation,
    this.points = 1,
    this.difficulty = 'medium',
    this.tags = const [],
  });

  // JSON se Dart Object convert karne ke liye
  factory ExamQuestion.fromJson(Map<String, dynamic> json) {
    return ExamQuestion(
      // Backend se _id aata hai
      id: json['_id'] ?? '', 
      questionText: json['question'] ?? '',
      
      // Options ki list ko map karna
      options: (json['options'] as List?)
              ?.map((o) => ExamOption.fromJson(o))
              .toList() ??
          [],
      
      explanation: json['explanation'],
      points: json['points'] ?? 1,
      difficulty: json['difficulty'] ?? 'medium',
      
      // Tags list handle karna
      tags: (json['tags'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }

  // Dart Object se JSON convert karne ke liye (Create/Update ke waqt)
  Map<String, dynamic> toJson() {
    return {
      if (id.isNotEmpty) '_id': id,
      'question': questionText,
      'options': options.map((o) => o.toJson()).toList(),
      'explanation': explanation,
      'points': points,
      'difficulty': difficulty,
      'tags': tags,
    };
  }
}

class ExamOption {
  final String text;
  final bool isCorrect;

  ExamOption({
    required this.text,
    this.isCorrect = false,
  });

  factory ExamOption.fromJson(Map<String, dynamic> json) {
    return ExamOption(
      text: json['text'] ?? '',
      isCorrect: json['isCorrect'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'text': text,
      'isCorrect': isCorrect,
    };
  }
}