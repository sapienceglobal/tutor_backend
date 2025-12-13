import 'package:flutter/material.dart';
import '../../models/course_model.dart';
import '../../models/exam_model.dart';
import '../../models/lesson_model.dart';
import '../../services/exam_service.dart';
import '../../services/ai_service.dart';
import '../../utils/constants.dart';

class CreateExamScreen extends StatefulWidget {
  final CourseModel course;
  final ExamModel? existingExam;

  const CreateExamScreen({super.key, required this.course, this.existingExam});

  @override
  State<CreateExamScreen> createState() => _CreateExamScreenState();
}

class _CreateExamScreenState extends State<CreateExamScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _instructionsController = TextEditingController();
  final _durationController = TextEditingController();
  final _passingMarksController = TextEditingController();

  String _examType = 'assessment';
  bool _shuffleQuestions = false;
  bool _shuffleOptions = false;
  bool _showResultImmediately = false;
  bool _showCorrectAnswers = true;
  bool _allowRetake = false;
  int _maxAttempts = 1;
  bool _isScheduled = false;
  DateTime? _startDate;
  DateTime? _endDate;

  List<ExamQuestion> _questions = [];
  bool _isLoading = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.existingExam != null) {
      _loadExistingExam();
    }
  }

  void _loadExistingExam() {
    final exam = widget.existingExam!;
    _titleController.text = exam.title;
    _descriptionController.text = exam.description;
    _instructionsController.text = exam.instructions ?? '';
    _durationController.text = exam.duration.toString();
    _passingMarksController.text = exam.passingMarks.toString();
    _examType = exam.type;
    _shuffleQuestions = exam.shuffleQuestions;
    _shuffleOptions = exam.shuffleOptions;
    _showResultImmediately = exam.showResultImmediately;
    _showCorrectAnswers = exam.showCorrectAnswers;
    _allowRetake = exam.allowRetake;
    _maxAttempts = exam.maxAttempts;
    _isScheduled = exam.isScheduled;
    _startDate = exam.startDate;
    _endDate = exam.endDate;
    _questions = List.from(exam.questions);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existingExam == null ? 'Create Exam' : 'Edit Exam'),
        actions: [
          if (_questions.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.auto_awesome),
              onPressed: _showAIGenerateDialog,
              tooltip: 'Generate more with AI',
            ),
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: _saveExam,
            tooltip: 'Save Exam',
          ),
        ],
      ),
      body: _isSaving
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBasicInfo(),
                    const SizedBox(height: 24),
                    _buildExamSettings(),
                    const SizedBox(height: 24),
                    _buildQuestionsSection(),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ),
      floatingActionButton: _questions.isEmpty
          ? FloatingActionButton.extended(
              onPressed: _showAddQuestionOptions,
              icon: const Icon(Icons.add),
              label: const Text('Add Questions'),
              backgroundColor: AppColors.primary,
            )
          : null,
    );
  }

  Widget _buildBasicInfo() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.title),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Title is required';
                }
                return null;
              },
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
            DropdownButtonFormField<String>(
              value: _examType,
              decoration: const InputDecoration(
                labelText: 'Exam Type',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.category),
              ),
              items: const [
                DropdownMenuItem(
                  value: 'assessment',
                  child: Text('Assessment'),
                ),
                DropdownMenuItem(value: 'midterm', child: Text('Midterm')),
                DropdownMenuItem(value: 'final', child: Text('Final')),
                DropdownMenuItem(value: 'quiz', child: Text('Quiz')),
                DropdownMenuItem(value: 'practice', child: Text('Practice')),
              ],
              onChanged: (value) => setState(() => _examType = value!),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _instructionsController,
              decoration: const InputDecoration(
                labelText: 'Instructions',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.info_outline),
                hintText: 'Instructions for students',
              ),
              maxLines: 3,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExamSettings() {
    return Card(
      child: ExpansionTile(
        title: const Text('Settings & Scheduling'),
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                // Duration & Marks
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _durationController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Duration (min)',
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Duration required';
                          }
                          if (int.tryParse(value) == null) {
                            return 'Enter valid number';
                          }
                          return null;
                        },
                      ),
                    ),

                    SizedBox(width: 16),

                    Expanded(
                      child: TextFormField(
                        controller: _passingMarksController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Passing %',
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Passing % required';
                          }
                          if (int.tryParse(value) == null) {
                            return 'Enter valid number';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),

                const Divider(),

                // Boolean Toggles
                SwitchListTile(
                  title: const Text('Shuffle Questions'),
                  subtitle: const Text(
                    'Randomize question order for each student',
                  ),
                  value: _shuffleQuestions,
                  onChanged: (val) => setState(() => _shuffleQuestions = val),
                ),
                SwitchListTile(
                  title: const Text('Allow Retake'),
                  value: _allowRetake,
                  onChanged: (val) => setState(() => _allowRetake = val),
                ),
                if (_allowRetake)
                  TextFormField(
                    decoration: const InputDecoration(
                      labelText: 'Max Attempts (0 for unlimited)',
                    ),
                    keyboardType: TextInputType.number,
                  ),

                SwitchListTile(
                  title: const Text('Show Results Immediately'),
                  value: _showResultImmediately,
                  onChanged: (val) =>
                      setState(() => _showResultImmediately = val),
                ),

                const Divider(),

                // Scheduling
                SwitchListTile(
                  title: const Text('Schedule Exam'),
                  value: _isScheduled,
                  onChanged: (val) => setState(() => _isScheduled = val),
                ),
                if (_isScheduled) ...[
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.calendar_today),
                    title: Text(
                      _startDate == null
                          ? 'Start Date'
                          : 'Start: ${_startDate!.toString().split(' ')[0]}',
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate: _startDate ?? DateTime.now(),
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (date != null) setState(() => _startDate = date);
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.calendar_today),
                    title: Text(
                      _endDate == null
                          ? 'End Date'
                          : 'End: ${_endDate!.toString().split(' ')[0]}',
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate:
                            _endDate ??
                            DateTime.now().add(const Duration(days: 7)),
                        firstDate: _startDate ?? DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (date != null) setState(() => _endDate = date);
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
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
            Text(
              'Questions (${_questions.length})',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (_questions.isEmpty)
              TextButton.icon(
                onPressed: _showAIGenerateDialog,
                icon: const Icon(Icons.auto_awesome),
                label: const Text('AI Generate'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (_questions.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.quiz_outlined,
                      size: 60,
                      color: Colors.grey[400],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No questions added yet',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _showAddQuestionOptions,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Questions'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else ...[
          ..._questions.asMap().entries.map((entry) {
            final index = entry.key;
            final question = entry.value;
            return _buildQuestionCard(question, index);
          }),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _addManualQuestion,
                  icon: const Icon(Icons.add),
                  label: const Text('Add Manual'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _showAIGenerateDialog,
                  icon: const Icon(Icons.auto_awesome),
                  label: const Text('AI Generate'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.purple,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildQuestionCard(ExamQuestion question, int index) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Q${index + 1}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.edit, size: 20),
                  onPressed: () => _editQuestion(index),
                ),
                IconButton(
                  icon: const Icon(Icons.delete, size: 20, color: Colors.red),
                  onPressed: () => setState(() => _questions.removeAt(index)),
                ),
              ],
            ),
            Text(question.question, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 8),
            ...question.options.asMap().entries.map((e) {
              final opt = e.value;
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Icon(
                      opt.isCorrect
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      size: 16,
                      color: opt.isCorrect ? Colors.green : Colors.grey,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        opt.text,
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  void _showAddQuestionOptions() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit, color: Colors.blue),
              title: const Text('Add Manually'),
              subtitle: const Text('Create questions one by one'),
              onTap: () {
                Navigator.pop(context);
                _addManualQuestion();
              },
            ),
            ListTile(
              leading: const Icon(Icons.auto_awesome, color: Colors.purple),
              title: const Text('Generate with AI'),
              subtitle: const Text('Auto-create multiple questions'),
              onTap: () {
                Navigator.pop(context);
                _showAIGenerateDialog();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _addManualQuestion() {
    _showQuestionDialog();
  }

  void _editQuestion(int index) {
    _showQuestionDialog(existingQuestion: _questions[index], index: index);
  }

  void _showQuestionDialog({ExamQuestion? existingQuestion, int? index}) {
    final questionController = TextEditingController(
      text: existingQuestion?.question ?? '',
    );
    final explanationController = TextEditingController(
      text: existingQuestion?.explanation ?? '',
    );
    final optionControllers = List.generate(
      4,
      (i) =>
          TextEditingController(text: existingQuestion?.options[i].text ?? ''),
    );
    int correctIndex =
        existingQuestion?.options.indexWhere((o) => o.isCorrect) ?? 0;
    String difficulty = existingQuestion?.difficulty ?? 'medium';

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            existingQuestion == null ? 'Add Question' : 'Edit Question',
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: questionController,
                  decoration: const InputDecoration(
                    labelText: 'Question',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 12),
                ...List.generate(
                  4,
                  (i) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Radio<int>(
                          value: i,
                          groupValue: correctIndex,
                          onChanged: (v) =>
                              setDialogState(() => correctIndex = v!),
                        ),
                        Expanded(
                          child: TextField(
                            controller: optionControllers[i],
                            decoration: InputDecoration(
                              labelText:
                                  'Option ${String.fromCharCode(65 + i)}',
                              border: const OutlineInputBorder(),
                              isDense: true,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
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
                  onChanged: (v) => setDialogState(() => difficulty = v!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: explanationController,
                  decoration: const InputDecoration(
                    labelText: 'Explanation (Optional)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final newQ = ExamQuestion(
                  id: DateTime.now().millisecondsSinceEpoch.toString(),
                  question: questionController.text,
                  options: List.generate(
                    4,
                    (i) => ExamOption(
                      text: optionControllers[i].text,
                      isCorrect: i == correctIndex,
                    ),
                  ),
                  explanation: explanationController.text.isEmpty
                      ? null
                      : explanationController.text,
                  difficulty: difficulty,
                );

                setState(() {
                  if (index != null) {
                    _questions[index] = newQ;
                  } else {
                    _questions.add(newQ);
                  }
                });
                Navigator.pop(context);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  void _showAIGenerateDialog() {
    final topicController = TextEditingController();
    int count = 10;
    String difficulty = 'medium';

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.auto_awesome, color: Colors.purple),
              SizedBox(width: 8),
              Text('AI Generate Questions'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: topicController,
                decoration: const InputDecoration(
                  labelText: 'Topic',
                  hintText: 'e.g., Data Structures',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      value: count,
                      decoration: const InputDecoration(
                        labelText: 'Count',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: [5, 10, 15, 20]
                          .map(
                            (n) =>
                                DropdownMenuItem(value: n, child: Text('$n')),
                          )
                          .toList(),
                      onChanged: (v) => setDialogState(() => count = v!),
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
                        DropdownMenuItem(
                          value: 'medium',
                          child: Text('Medium'),
                        ),
                        DropdownMenuItem(value: 'hard', child: Text('Hard')),
                      ],
                      onChanged: (v) => setDialogState(() => difficulty = v!),
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
                Navigator.pop(context);
                _generateWithAI(topicController.text, count, difficulty);
              },
              icon: const Icon(Icons.auto_awesome),
              label: const Text('Generate'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.purple,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _generateWithAI(
    String topic,
    int count,
    String difficulty,
  ) async {
    setState(() => _isLoading = true);

    try {
      final result = await AIService.generateQuestions(
        topic: topic,
        count: count,
        difficulty: difficulty,
      );

      if (result['success']) {
        final aiQuestions = result['questions'] as List;
        setState(() {
          _questions.addAll(
            aiQuestions.map(
              (q) => ExamQuestion(
                id:
                    DateTime.now().millisecondsSinceEpoch.toString() +
                    _questions.length.toString(),
                question: q['question'],
                options: (q['options'] as List)
                    .asMap()
                    .entries
                    .map(
                      (e) => ExamOption(
                        text: e.value,
                        isCorrect: e.value == q['correctAnswer'],
                      ),
                    )
                    .toList(),
                explanation: q['explanation'],
                difficulty: q['difficulty'] ?? difficulty,
              ),
            ),
          );
        });

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Generated ${aiQuestions.length} questions!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('AI failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveExam() async {
    if (!_formKey.currentState!.validate()) return;

    if (_questions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add at least one question'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final duration = int.tryParse(_durationController.text.trim());
      final passingMarks = int.tryParse(_passingMarksController.text.trim());

      if (duration == null || passingMarks == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Duration aur Passing Marks valid are not valid'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isSaving = false);
        return;
      }

      final questionsJson = _questions.map((q) => q.toJson()).toList();

      Map<String, dynamic> response;

      if (widget.existingExam == null) {
        response = await ExamService.createExam(
          courseId: widget.course.id,
          title: _titleController.text,
          description: _descriptionController.text,
          type: _examType,
          instructions: _instructionsController.text.isEmpty
              ? null
              : _instructionsController.text,
          duration: duration,
          passingMarks: passingMarks,
          questions: questionsJson,
          shuffleQuestions: _shuffleQuestions,
          shuffleOptions: _shuffleOptions,
          showResultImmediately: _showResultImmediately,
          showCorrectAnswers: _showCorrectAnswers,
          allowRetake: _allowRetake,
          maxAttempts: _maxAttempts,
          startDate: _startDate,
          endDate: _endDate,
        );
      } else {
        response = await ExamService.updateExam(
          id: widget.existingExam!.id,
          updates: {
            'title': _titleController.text,
            'description': _descriptionController.text,
            'type': _examType,
            'instructions': _instructionsController.text,
            'duration': duration,
            'passingMarks': passingMarks,
            'questions': questionsJson,
            'shuffleQuestions': _shuffleQuestions,
            'shuffleOptions': _shuffleOptions,
            'showResultImmediately': _showResultImmediately,
            'showCorrectAnswers': _showCorrectAnswers,
            'allowRetake': _allowRetake,
            'maxAttempts': _maxAttempts,
            'startDate': _startDate?.toIso8601String(),
            'endDate': _endDate?.toIso8601String(),
            'isScheduled': _isScheduled,
          },
        );
      }

      if (mounted && response['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.existingExam == null
                  ? 'Exam created successfully! It is saved as a draft. You can publish it anytime.'
                  : 'Exam updated successfully!',
            ),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      print("Error AAGYA Bhai $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isSaving = false);
    }
  }
}
