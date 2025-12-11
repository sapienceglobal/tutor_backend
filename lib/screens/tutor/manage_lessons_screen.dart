import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:my_app/widgets/quiz_builder_screen.dart';
import 'dart:io';
import '../../models/course_model.dart';
import '../../models/lesson_model.dart';
import '../../services/lesson_service.dart';
import '../../services/upload_service.dart';
import '../../utils/constants.dart';

class ManageLessonsScreen extends StatefulWidget {
  final CourseModel course;

  const ManageLessonsScreen({super.key, required this.course});

  @override
  State<ManageLessonsScreen> createState() => _ManageLessonsScreenState();
}

class _ManageLessonsScreenState extends State<ManageLessonsScreen> {
  Map<String, List<LessonModel>> _lessonsByModule = {};
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadLessons();
  }

  Future<void> _loadLessons() async {
    setState(() => _isLoading = true);

    try {
      final result = await LessonService.getLessonsByCourse(widget.course.id);

      if (result['success']) {
        final lessons = result['lessons'] as List<LessonModel>;
        Map<String, List<LessonModel>> grouped = {};

        for (var lesson in lessons) {
          if (!grouped.containsKey(lesson.moduleId)) {
            grouped[lesson.moduleId] = [];
          }
          grouped[lesson.moduleId]!.add(lesson);
        }

        grouped.forEach((key, value) {
          value.sort((a, b) => a.order.compareTo(b.order));
        });

        setState(() => _lessonsByModule = grouped);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Lessons'), elevation: 0),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : widget.course.modules.isEmpty
          ? _buildEmptyModules()
          : RefreshIndicator(
              onRefresh: _loadLessons,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: widget.course.modules.length,
                itemBuilder: (context, index) {
                  final module = widget.course.modules[index];
                  final lessons = _lessonsByModule[module.id] ?? [];
                  return _buildModuleCard(module, lessons);
                },
              ),
            ),
    );
  }

  Widget _buildEmptyModules() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.video_library_outlined, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No modules added yet',
            style: TextStyle(fontSize: 16, color: Colors.grey[600]),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Edit course to add modules first'),
                ),
              );
            },
            icon: const Icon(Icons.add),
            label: const Text('Add Modules'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleCard(CourseModule module, List<LessonModel> lessons) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.all(16),
        childrenPadding: const EdgeInsets.only(bottom: 12),
        title: Text(
          module.title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (module.description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                module.description,
                style: TextStyle(fontSize: 13, color: Colors.grey[600]),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.video_library, size: 14, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  '${lessons.length} lessons',
                  style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                ),
              ],
            ),
          ],
        ),
        children: [
          if (lessons.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    'No lessons yet',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () => _showAddLessonDialog(module),
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Add Lesson'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            )
          else ...[
            ...lessons.map((lesson) => _buildLessonTile(lesson, module)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: OutlinedButton.icon(
                onPressed: () => _showAddLessonDialog(module),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add Another Lesson'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: BorderSide(color: AppColors.primary),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLessonTile(LessonModel lesson, CourseModule module) {
    IconData lessonIcon;
    Color iconColor;

    switch (lesson.type) {
      case 'video':
        lessonIcon = Icons.play_circle_outline;
        iconColor = Colors.blue;
        break;
      case 'document':
        lessonIcon = Icons.description_outlined;
        iconColor = Colors.orange;
        break;
      case 'quiz':
        lessonIcon = Icons.quiz_outlined;
        iconColor = Colors.purple;
        break;
      default:
        lessonIcon = Icons.menu_book;
        iconColor = Colors.grey;
    }

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(lessonIcon, color: iconColor, size: 20),
      ),
      title: Text(
        lesson.title,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: _buildLessonSubtitle(lesson),
      trailing: PopupMenuButton<String>(
        icon: const Icon(Icons.more_vert),
        onSelected: (value) {
          if (value == 'edit') {
            _showEditLessonDialog(lesson, module);
          } else if (value == 'delete') {
            _confirmDeleteLesson(lesson);
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(
            value: 'edit',
            child: Row(
              children: [
                Icon(Icons.edit, size: 20),
                SizedBox(width: 8),
                Text('Edit'),
              ],
            ),
          ),
          const PopupMenuItem(
            value: 'delete',
            child: Row(
              children: [
                Icon(Icons.delete, size: 20, color: Colors.red),
                SizedBox(width: 8),
                Text('Delete', style: TextStyle(color: Colors.red)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLessonSubtitle(LessonModel lesson) {
    return Row(
      children: [
        if (lesson.isFree)
          Container(
            margin: const EdgeInsets.only(top: 4, right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text(
              'FREE',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.green,
              ),
            ),
          ),
        if (lesson.type == 'video' && lesson.content.duration != null)
          Text(
            '${(lesson.content.duration! / 60).toStringAsFixed(0)} min',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          )
        else if (lesson.type == 'document')
          Text(
            '${lesson.content.documents.length} docs',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          )
        else if (lesson.type == 'quiz' && lesson.content.quiz != null)
          Text(
            '${lesson.content.quiz!.questions.length} questions',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
      ],
    );
  }

  void _showAddLessonDialog(CourseModule module) {
    _showLessonDialog(title: 'Add Lesson', moduleId: module.id);
  }

  void _showEditLessonDialog(LessonModel lesson, CourseModule module) {
    _showLessonDialog(
      title: 'Edit Lesson',
      moduleId: module.id,
      existingLesson: lesson,
    );
  }

  void _showLessonDialog({
    required String title,
    required String moduleId,
    LessonModel? existingLesson,
  }) {
    final titleController = TextEditingController(
      text: existingLesson?.title ?? '',
    );
    final descriptionController = TextEditingController(
      text: existingLesson?.description ?? '',
    );
    final videoUrlController = TextEditingController(
      text: existingLesson?.content.videoUrl ?? '',
    );
    final durationController = TextEditingController(
      text: existingLesson?.content.duration?.toString() ?? '',
    );
    final documentUrlController = TextEditingController();

    String lessonType = existingLesson?.type ?? 'video';
    bool isFree = existingLesson?.isFree ?? false;
    bool isPublished = existingLesson?.isPublished ?? true;
    List<DocumentData> documents = List.from(
      existingLesson?.content.documents ?? [],
    );
    QuizData? quizData = existingLesson?.content.quiz;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(title),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: MediaQuery.of(context).size.width * 0.9,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextField(
                        controller: titleController,
                        decoration: const InputDecoration(
                          labelText: 'Lesson Title *',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: descriptionController,
                        decoration: const InputDecoration(
                          labelText: 'Description',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: lessonType,
                        decoration: const InputDecoration(
                          labelText: 'Lesson Type',
                          border: OutlineInputBorder(),
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'video',
                            child: Row(
                              children: [
                                Icon(Icons.play_circle_outline, size: 20),
                                SizedBox(width: 8),
                                Text('Video'),
                              ],
                            ),
                          ),
                          DropdownMenuItem(
                            value: 'document',
                            child: Row(
                              children: [
                                Icon(Icons.description_outlined, size: 20),
                                SizedBox(width: 8),
                                Text('Document'),
                              ],
                            ),
                          ),
                          DropdownMenuItem(
                            value: 'quiz',
                            child: Row(
                              children: [
                                Icon(Icons.quiz_outlined, size: 20),
                                SizedBox(width: 8),
                                Text('Quiz'),
                              ],
                            ),
                          ),
                        ],
                        onChanged: (value) {
                          setDialogState(() => lessonType = value!);
                        },
                      ),
                      const SizedBox(height: 12),

                      // VIDEO TYPE
                      if (lessonType == 'video') ...[
                        TextField(
                          controller: videoUrlController,
                          decoration: const InputDecoration(
                            labelText: 'Video URL *',
                            hintText: 'https://youtube.com/watch?v=...',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: durationController,
                          decoration: const InputDecoration(
                            labelText: 'Duration (seconds)',
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ],

                      // DOCUMENT TYPE
                      if (lessonType == 'document') ...[
                        _buildDocumentSection(
                          documents,
                          documentUrlController,
                          setDialogState,
                        ),
                      ],

                      // QUIZ TYPE
                      if (lessonType == 'quiz') ...[
                        _buildQuizSection(quizData, moduleId, setDialogState, (
                          newQuiz,
                        ) {
                          quizData = newQuiz;
                        }),
                      ],

                      const SizedBox(height: 12),
                      SwitchListTile(
                        title: const Text('Free Preview'),
                        subtitle: const Text('Allow non-enrolled students'),
                        value: isFree,
                        onChanged: (value) =>
                            setDialogState(() => isFree = value),
                        contentPadding: EdgeInsets.zero,
                      ),
                      SwitchListTile(
                        title: const Text('Published'),
                        subtitle: const Text('Visible to students'),
                        value: isPublished,
                        onChanged: (value) =>
                            setDialogState(() => isPublished = value),
                        contentPadding: EdgeInsets.zero,
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
                  onPressed: () => _saveLesson(
                    context: context,
                    moduleId: moduleId,
                    existingLesson: existingLesson,
                    title: titleController.text,
                    description: descriptionController.text,
                    lessonType: lessonType,
                    videoUrl: videoUrlController.text,
                    duration: durationController.text,
                    documents: documents,
                    quizData: quizData,
                    isFree: isFree,
                    isPublished: isPublished,
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(existingLesson == null ? 'Add' : 'Update'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildDocumentSection(
    List<DocumentData> documents,
    TextEditingController urlController,
    StateSetter setDialogState,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Documents', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ...documents.map(
          (doc) => ListTile(
            dense: true,
            leading: const Icon(Icons.insert_drive_file, size: 20),
            title: Text(doc.name, style: const TextStyle(fontSize: 13)),
            trailing: IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: () => setDialogState(() => documents.remove(doc)),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: urlController,
                decoration: const InputDecoration(
                  labelText: 'Document URL',
                  hintText: 'https://...',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: () {
                if (urlController.text.isNotEmpty) {
                  setDialogState(() {
                    documents.add(
                      DocumentData(
                        name: 'Document ${documents.length + 1}',
                        url: urlController.text,
                        type: 'pdf',
                      ),
                    );
                    urlController.clear();
                  });
                }
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _pickAndUploadFile(setDialogState, documents),
          icon: const Icon(Icons.upload_file, size: 18),
          label: const Text('Upload File'),
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.primary),
        ),
      ],
    );
  }

  Widget _buildQuizSection(
    QuizData? quizData,
    String moduleId,
    StateSetter setDialogState,
    Function(QuizData) onQuizUpdated,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (quizData == null || quizData.questions.isEmpty)
          Column(
            children: [
              const Text('No quiz created yet'),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => QuizBuilderScreen(
                        courseId: widget.course.id,
                        lessonTitle: 'New Quiz',
                      ),
                    ),
                  );
                  if (result != null) {
                    setDialogState(() => onQuizUpdated(result));
                  }
                },
                icon: const Icon(Icons.add),
                label: const Text('Create Quiz'),
              ),
            ],
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Quiz: ${quizData.questions.length} questions',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => QuizBuilderScreen(
                        courseId: widget.course.id,
                        lessonTitle: 'Edit Quiz',
                        existingQuiz: quizData,
                      ),
                    ),
                  );
                  if (result != null) {
                    setDialogState(() => onQuizUpdated(result));
                  }
                },
                icon: const Icon(Icons.edit),
                label: const Text('Edit Quiz'),
              ),
            ],
          ),
      ],
    );
  }

  Future<void> _pickAndUploadFile(
    StateSetter setDialogState,
    List<DocumentData> documents,
  ) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'],
      );

      if (result != null && result.files.single.path != null) {
        setState(() => _isLoading = true);

        final file = File(result.files.single.path!);
        final uploadResult = await UploadService.uploadFile(file);

        if (uploadResult['success']) {
          final fileData = uploadResult['file'];
          setDialogState(() {
            documents.add(
              DocumentData(
                name: fileData['originalName'] ?? 'Document',
                url: fileData['url'],
                type: fileData['format'] ?? 'pdf',
                size: fileData['size'],
              ),
            );
          });

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('File uploaded!'),
                backgroundColor: Colors.green,
              ),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveLesson({
    required BuildContext context,
    required String moduleId,
    LessonModel? existingLesson,
    required String title,
    required String description,
    required String lessonType,
    required String videoUrl,
    required String duration,
    required List<DocumentData> documents,
    QuizData? quizData,
    required bool isFree,
    required bool isPublished,
  }) async {
    if (title.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter lesson title'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (lessonType == 'video' && videoUrl.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter video URL'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (lessonType == 'document' && documents.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please add at least one document'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (lessonType == 'quiz' &&
        (quizData == null || quizData.questions.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please create quiz questions'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    Navigator.pop(context);
    setState(() => _isLoading = true);

    try {
      Map<String, dynamic> content = {};

      if (lessonType == 'video') {
        content['videoUrl'] = videoUrl.trim();
        if (duration.isNotEmpty) {
          content['duration'] = int.tryParse(duration) ?? 0;
        }
      } else if (lessonType == 'document') {
        content['documents'] = documents.map((d) => d.toJson()).toList();
      } else if (lessonType == 'quiz' && quizData != null) {
        // ✅ Use toJsonClean() instead of toJson()
        content['quiz'] = quizData.toJsonClean();
      }

      Map<String, dynamic> response;

      if (existingLesson == null) {
        response = await LessonService.createLesson(
          courseId: widget.course.id,
          moduleId: moduleId,
          title: title.trim(),
          description: description.trim(),
          type: lessonType,
          content: content,
          isFree: isFree,
        );
      } else {
        response = await LessonService.updateLesson(
          id: existingLesson.id,
          updates: {
            'title': title.trim(),
            'description': description.trim(),
            'type': lessonType,
            'content': content,
            'isFree': isFree,
            'isPublished': isPublished,
          },
        );
      }

      if (mounted && response['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              existingLesson == null ? 'Lesson created!' : 'Lesson updated!',
            ),
            backgroundColor: Colors.green,
          ),
        );
        _loadLessons();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _confirmDeleteLesson(LessonModel lesson) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Lesson'),
        content: Text('Delete "${lesson.title}"?'),
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
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      setState(() => _isLoading = true);

      try {
        final response = await LessonService.deleteLesson(lesson.id);
        if (mounted && response['success']) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Lesson deleted!'),
              backgroundColor: Colors.green,
            ),
          );
          _loadLessons();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
          );
        }
      } finally {
        setState(() => _isLoading = false);
      }
    }
  }
}
