import 'package:flutter/material.dart';
import '../../models/lesson_model.dart';
import '../../services/ai_service.dart';
import '../../utils/constants.dart';

class QuizBuilderScreen extends StatefulWidget {
  final String courseId;
  final String lessonTitle;
  final QuizData? existingQuiz;

  const QuizBuilderScreen({
    super.key,
    required this.courseId,
    required this.lessonTitle,
    this.existingQuiz,
  });

  @override
  State<QuizBuilderScreen> createState() => _QuizBuilderScreenState();
}

class _QuizBuilderScreenState extends State<QuizBuilderScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  
  int _passingScore = 70;
  int? _timeLimit;
  bool _shuffleQuestions = false;
  bool _shuffleOptions = false;
  bool _showCorrectAnswers = true;
  bool _allowRetake = true;
  int? _maxAttempts;
  
  List<QuizQuestion> _questions = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.existingQuiz != null) {
      _titleController.text = widget.existingQuiz!.title ?? '';
      _descriptionController.text = widget.existingQuiz!.description ?? '';
      _passingScore = widget.existingQuiz!.passingScore;
      _timeLimit = widget.existingQuiz!.timeLimit;
      _shuffleQuestions = widget.existingQuiz!.shuffleQuestions;
      _shuffleOptions = widget.existingQuiz!.shuffleOptions;
      _showCorrectAnswers = widget.existingQuiz!.showCorrectAnswers;
      _allowRetake = widget.existingQuiz!.allowRetake;
      _maxAttempts = widget.existingQuiz!.maxAttempts;
      _questions = List.from(widget.existingQuiz!.questions);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Quiz Builder'),
        actions: [
          IconButton(
            icon: const Icon(Icons.auto_awesome),
            onPressed: _showAIGenerateDialog,
            tooltip: 'Generate with AI',
          ),
          IconButton(
            icon: const Icon(Icons.check),
            onPressed: _saveQuiz,
            tooltip: 'Save Quiz',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildQuizSettings(),
                    const SizedBox(height: 24),
                    _buildQuestionsSection(),
                  ],
                ),
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addQuestion,
        icon: const Icon(Icons.add),
        label: const Text('Add Question'),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  Widget _buildQuizSettings() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quiz Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Quiz Title',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.title),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.description),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: _passingScore.toString(),
                    decoration: const InputDecoration(
                      labelText: 'Passing Score (%)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.trending_up),
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) => _passingScore = int.tryParse(value) ?? 70,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    initialValue: _timeLimit?.toString() ?? '',
                    decoration: const InputDecoration(
                      labelText: 'Time Limit (min)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.timer),
                      hintText: 'Optional',
                    ),
                    keyboardType: TextInputType.number,
                    onChanged: (value) => _timeLimit = int.tryParse(value),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
            SwitchListTile(
              title: const Text('Shuffle Questions'),
              subtitle: const Text('Randomize question order'),
              value: _shuffleQuestions,
              onChanged: (value) => setState(() => _shuffleQuestions = value),
              contentPadding: EdgeInsets.zero,
            ),
            SwitchListTile(
              title: const Text('Shuffle Options'),
              subtitle: const Text('Randomize answer options'),
              value: _shuffleOptions,
              onChanged: (value) => setState(() => _shuffleOptions = value),
              contentPadding: EdgeInsets.zero,
            ),
            SwitchListTile(
              title: const Text('Show Correct Answers'),
              subtitle: const Text('After submission'),
              value: _showCorrectAnswers,
              onChanged: (value) => setState(() => _showCorrectAnswers = value),
              contentPadding: EdgeInsets.zero,
            ),
            SwitchListTile(
              title: const Text('Allow Retake'),
              subtitle: const Text('Students can retry'),
              value: _allowRetake,
              onChanged: (value) => setState(() => _allowRetake = value),
              contentPadding: EdgeInsets.zero,
            ),
            if (_allowRetake)
              Padding(
                padding: const EdgeInsets.only(left: 16, top: 8),
                child: TextFormField(
                  initialValue: _maxAttempts?.toString() ?? '',
                  decoration: const InputDecoration(
                    labelText: 'Max Attempts',
                    hintText: 'Leave empty for unlimited',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  keyboardType: TextInputType.number,
                  onChanged: (value) => _maxAttempts = int.tryParse(value),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Questions (${_questions.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (_questions.isEmpty)
              TextButton.icon(
                onPressed: _showAIGenerateDialog,
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Generate with AI'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (_questions.isEmpty)
          Center(
            child: Column(
              children: [
                Icon(Icons.quiz_outlined, size: 80, color: Colors.grey[300]),
                const SizedBox(height: 16),
                Text('No questions yet', style: TextStyle(color: Colors.grey[600])),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _addQuestion,
                  icon: const Icon(Icons.add),
                  label: const Text('Add Question'),
                ),
              ],
            ),
          )
        else
          ..._questions.asMap().entries.map((entry) {
            final index = entry.key;
            final question = entry.value;
            return _buildQuestionCard(question, index);
          }),
      ],
    );
  }

  Widget _buildQuestionCard(QuizQuestion question, int index) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('Question ${index + 1}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
                IconButton(
                  icon: const Icon(Icons.edit, size: 20),
                  onPressed: () => _editQuestion(index),
                ),
                IconButton(
                  icon: const Icon(Icons.delete, size: 20, color: Colors.red),
                  onPressed: () => _deleteQuestion(index),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(question.question, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 12),
            ...question.options.asMap().entries.map((entry) {
              final optIndex = entry.key;
              final option = entry.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: option.isCorrect ? Colors.green : Colors.grey[200],
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        String.fromCharCode(65 + optIndex),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: option.isCorrect ? Colors.white : Colors.black,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        option.text,
                        style: TextStyle(
                          fontSize: 13,
                          color: option.isCorrect ? Colors.green[700] : Colors.black87,
                          fontWeight: option.isCorrect ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
            if (question.explanation != null && question.explanation!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: Colors.blue),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        question.explanation!,
                        style: const TextStyle(fontSize: 12, color: Colors.blue),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _addQuestion() {
    _showQuestionDialog();
  }

  void _editQuestion(int index) {
    _showQuestionDialog(existingQuestion: _questions[index], index: index);
  }

  void _deleteQuestion(int index) {
    setState(() => _questions.removeAt(index));
  }

  void _showQuestionDialog({QuizQuestion? existingQuestion, int? index}) {
    final questionController = TextEditingController(text: existingQuestion?.question ?? '');
    final explanationController = TextEditingController(text: existingQuestion?.explanation ?? '');
    final optionControllers = List.generate(
      4,
      (i) => TextEditingController(
        text: (existingQuestion?.options.length ?? 0) > i ? existingQuestion!.options[i].text : '',
      ),
    );
    int correctOptionIndex = existingQuestion?.options.indexWhere((opt) => opt.isCorrect) ?? 0;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(existingQuestion == null ? 'Add Question' : 'Edit Question'),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: MediaQuery.of(context).size.width * 0.9,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(
                        controller: questionController,
                        decoration: const InputDecoration(
                          labelText: 'Question *',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 16),
                      const Text('Options:', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...List.generate(4, (i) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Radio<int>(
                                value: i,
                                groupValue: correctOptionIndex,
                                onChanged: (value) {
                                  setDialogState(() => correctOptionIndex = value!);
                                },
                              ),
                              Expanded(
                                child: TextField(
                                  controller: optionControllers[i],
                                  decoration: InputDecoration(
                                    labelText: 'Option ${String.fromCharCode(65 + i)}',
                                    border: const OutlineInputBorder(),
                                    isDense: true,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                      const SizedBox(height: 12),
                      TextField(
                        controller: explanationController,
                        decoration: const InputDecoration(
                          labelText: 'Explanation (Optional)',
                          border: OutlineInputBorder(),
                          hintText: 'Why is this the correct answer?',
                        ),
                        maxLines: 2,
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (questionController.text.isEmpty || optionControllers.any((c) => c.text.isEmpty)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('All fields are required'), backgroundColor: Colors.red),
                      );
                      return;
                    }

                    final newQuestion = QuizQuestion(
                      id: '', // Don't send _id, let backend generate it
                      question: questionController.text,
                      options: List.generate(
                        4,
                        (i) => QuizOption(
                          text: optionControllers[i].text,
                          isCorrect: i == correctOptionIndex,
                        ),
                      ),
                      explanation: explanationController.text.isEmpty ? null : explanationController.text,
                    );

                    setState(() {
                      if (index != null) {
                        _questions[index] = newQuestion;
                      } else {
                        _questions.add(newQuestion);
                      }
                    });

                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(existingQuestion == null ? 'Add' : 'Update'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showAIGenerateDialog() {
    final topicController = TextEditingController();
    int count = 5;
    String difficulty = 'medium';

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.auto_awesome, color: Colors.purple),
                  SizedBox(width: 8),
                  Text('Generate with AI'),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: topicController,
                    decoration: const InputDecoration(
                      labelText: 'Topic',
                      hintText: 'e.g., JavaScript arrays',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.topic),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          value: count,
                          decoration: const InputDecoration(
                            labelText: 'Questions',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          items: [3, 5, 10, 15].map((n) => DropdownMenuItem(value: n, child: Text('$n'))).toList(),
                          onChanged: (value) => setDialogState(() => count = value!),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: difficulty,
                          decoration: const InputDecoration(
                            labelText: 'Difficulty',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          items: const [
                            DropdownMenuItem(value: 'easy', child: Text('Easy')),
                            DropdownMenuItem(value: 'medium', child: Text('Medium')),
                            DropdownMenuItem(value: 'hard', child: Text('Hard')),
                          ],
                          onChanged: (value) => setDialogState(() => difficulty = value!),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton.icon(
                  onPressed: () {
                    if (topicController.text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Please enter a topic'), backgroundColor: Colors.red),
                      );
                      return;
                    }
                    Navigator.pop(context);
                    _generateQuestionsWithAI(topicController.text, count, difficulty);
                  },
                  icon: const Icon(Icons.auto_awesome),
                  label: const Text('Generate'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _generateQuestionsWithAI(String topic, int count, String difficulty) async {
    setState(() => _isLoading = true);

    try {
      final result = await AIService.generateQuestions(
        topic: topic,
        count: count,
        difficulty: difficulty,
      );

      if (result['success']) {
        final aiQuestions = result['questions'] as List;
        final newQuestions = aiQuestions.map((q) {
          return QuizQuestion(
            id: DateTime.now().millisecondsSinceEpoch.toString() + _questions.length.toString(),
            question: q['question'],
            options: (q['options'] as List).asMap().entries.map((entry) {
              return QuizOption(
                text: entry.value.toString(),
                isCorrect: entry.value.toString() == q['correctAnswer'],
              );
            }).toList(),
            explanation: q['explanation'],
          );
        }).toList();

        setState(() => _questions.addAll(newQuestions));

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Generated ${newQuestions.length} questions!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('AI generation failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _saveQuiz() {
    if (_questions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one question'), backgroundColor: Colors.red),
      );
      return;
    }

    final quiz = QuizData(
      title: _titleController.text,
      description: _descriptionController.text,
      passingScore: _passingScore,
      timeLimit: _timeLimit,
      questions: _questions,
      shuffleQuestions: _shuffleQuestions,
      shuffleOptions: _shuffleOptions,
      showCorrectAnswers: _showCorrectAnswers,
      allowRetake: _allowRetake,
      maxAttempts: _maxAttempts,
    );

    Navigator.pop(context, quiz);
  }
}