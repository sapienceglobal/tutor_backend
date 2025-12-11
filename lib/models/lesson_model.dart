class QuizQuestion {
  final String id;
  final String question;
  final List<QuizOption> options;
  final String? explanation;
  final int points;

  QuizQuestion({
    required this.id,
    required this.question,
    required this.options,
    this.explanation,
    this.points = 1,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      id: json['_id'] ?? '',
      question: json['question'] ?? '',
      options: (json['options'] as List?)
              ?.map((o) => QuizOption.fromJson(o))
              .toList() ??
          [],
      explanation: json['explanation'],
      points: json['points'] ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{
      'question': question,
      'options': options.map((o) => o.toJson()).toList(),
      'points': points,
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

  // ✅ NEW: Clean version without _id
  Map<String, dynamic> toJsonClean() {
    final json = <String, dynamic>{
      'question': question,
      'options': options.map((o) => o.toJsonClean()).toList(),
      'points': points,
    };

    if (explanation != null && explanation!.isNotEmpty) {
      json['explanation'] = explanation;
    }

    return json;
  }
}

class QuizOption {
  final String text;
  final bool isCorrect;

  QuizOption({
    required this.text,
    this.isCorrect = false,
  });

  factory QuizOption.fromJson(Map<String, dynamic> json) {
    return QuizOption(
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

  // ✅ NEW: Clean version (same as toJson, but for consistency)
  Map<String, dynamic> toJsonClean() {
    return {
      'text': text,
      'isCorrect': isCorrect,
    };
  }
}

class QuizData {
  final String? title;
  final String? description;
  final int passingScore;
  final int? timeLimit;
  final List<QuizQuestion> questions;
  final int? totalPoints;
  final bool shuffleQuestions;
  final bool shuffleOptions;
  final bool showCorrectAnswers;
  final bool allowRetake;
  final int? maxAttempts;

  QuizData({
    this.title,
    this.description,
    this.passingScore = 70,
    this.timeLimit,
    this.questions = const [],
    this.totalPoints,
    this.shuffleQuestions = false,
    this.shuffleOptions = false,
    this.showCorrectAnswers = true,
    this.allowRetake = true,
    this.maxAttempts,
  });

  factory QuizData.fromJson(Map<String, dynamic> json) {
    return QuizData(
      title: json['title'],
      description: json['description'],
      passingScore: json['passingScore'] ?? 70,
      timeLimit: json['timeLimit'],
      questions: (json['questions'] as List?)
              ?.map((q) => QuizQuestion.fromJson(q))
              .toList() ??
          [],
      totalPoints: json['totalPoints'],
      shuffleQuestions: json['shuffleQuestions'] ?? false,
      shuffleOptions: json['shuffleOptions'] ?? false,
      showCorrectAnswers: json['showCorrectAnswers'] ?? true,
      allowRetake: json['allowRetake'] ?? true,
      maxAttempts: json['maxAttempts'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'passingScore': passingScore,
      'timeLimit': timeLimit,
      'questions': questions.map((q) => q.toJson()).toList(),
      'totalPoints': totalPoints,
      'shuffleQuestions': shuffleQuestions,
      'shuffleOptions': shuffleOptions,
      'showCorrectAnswers': showCorrectAnswers,
      'allowRetake': allowRetake,
      'maxAttempts': maxAttempts,
    };
  }

  // ✅ NEW: Clean version for backend (without _id in questions)
  Map<String, dynamic> toJsonClean() {
    return {
      'title': title,
      'description': description,
      'passingScore': passingScore,
      'timeLimit': timeLimit,
      'questions': questions.map((q) => q.toJsonClean()).toList(), // ✅ Use clean version
      'totalPoints': totalPoints,
      'shuffleQuestions': shuffleQuestions,
      'shuffleOptions': shuffleOptions,
      'showCorrectAnswers': showCorrectAnswers,
      'allowRetake': allowRetake,
      'maxAttempts': maxAttempts,
    };
  }
}

class DocumentData {
  final String name;
  final String url;
  final String type;
  final int? size;

  DocumentData({
    required this.name,
    required this.url,
    required this.type,
    this.size,
  });

  factory DocumentData.fromJson(Map<String, dynamic> json) {
    return DocumentData(
      name: json['name'] ?? '',
      url: json['url'] ?? '',
      type: json['type'] ?? '',
      size: json['size'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'url': url,
      'type': type,
      'size': size,
    };
  }
}

class LessonContent {
  final String? videoUrl;
  final int? duration;
  final List<DocumentData> documents;
  final QuizData? quiz;
  final List<LessonAttachment> attachments;

  LessonContent({
    this.videoUrl,
    this.duration,
    this.documents = const [],
    this.quiz,
    this.attachments = const [],
  });

  factory LessonContent.fromJson(Map<String, dynamic> json) {
    return LessonContent(
      videoUrl: json['videoUrl'],
      duration: json['duration'],
      documents: (json['documents'] as List?)
              ?.map((d) => DocumentData.fromJson(d))
              .toList() ??
          [],
      quiz: json['quiz'] != null ? QuizData.fromJson(json['quiz']) : null,
      attachments: (json['attachments'] as List?)
              ?.map((a) => LessonAttachment.fromJson(a))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'videoUrl': videoUrl,
      'duration': duration,
      'documents': documents.map((d) => d.toJson()).toList(),
      'quiz': quiz?.toJson(),
      'attachments': attachments.map((a) => a.toJson()).toList(),
    };
  }

  // ✅ NEW: Clean version for backend
  Map<String, dynamic> toJsonClean() {
    return {
      'videoUrl': videoUrl,
      'duration': duration,
      'documents': documents.map((d) => d.toJson()).toList(),
      'quiz': quiz?.toJsonClean(), // ✅ Use clean version for quiz
      'attachments': attachments.map((a) => a.toJson()).toList(),
    };
  }
}

class LessonAttachment {
  final String name;
  final String url;
  final String type;

  LessonAttachment({
    required this.name,
    required this.url,
    required this.type,
  });

  factory LessonAttachment.fromJson(Map<String, dynamic> json) {
    return LessonAttachment(
      name: json['name'] ?? '',
      url: json['url'] ?? '',
      type: json['type'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'url': url,
      'type': type,
    };
  }
}

class LessonModel {
  final String id;
  final String courseId;
  final String moduleId;
  final String title;
  final String description;
  final String type;
  final LessonContent content;
  final int order;
  final bool isFree;
  final bool isPublished;
  final DateTime createdAt;

  LessonModel({
    required this.id,
    required this.courseId,
    required this.moduleId,
    required this.title,
    this.description = '',
    this.type = 'video',
    required this.content,
    this.order = 0,
    this.isFree = false,
    this.isPublished = true,
    required this.createdAt,
  });

  factory LessonModel.fromJson(Map<String, dynamic> json) {
    return LessonModel(
      id: json['_id'] ?? '',
      courseId: json['courseId'] ?? '',
      moduleId: json['moduleId'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'video',
      content: LessonContent.fromJson(json['content'] ?? {}),
      order: json['order'] ?? 0,
      isFree: json['isFree'] ?? false,
      isPublished: json['isPublished'] ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'courseId': courseId,
      'moduleId': moduleId,
      'title': title,
      'description': description,
      'type': type,
      'content': content.toJson(),
      'order': order,
      'isFree': isFree,
      'isPublished': isPublished,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  // ✅ NEW: Clean version for creating/updating lessons
  Map<String, dynamic> toJsonClean() {
    return {
      '_id': id,
      'courseId': courseId,
      'moduleId': moduleId,
      'title': title,
      'description': description,
      'type': type,
      'content': content.toJsonClean(), // ✅ Use clean version
      'order': order,
      'isFree': isFree,
      'isPublished': isPublished,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}