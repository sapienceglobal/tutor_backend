import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/course_provider.dart';
import '../../providers/category_provider.dart';
import '../../models/category_model.dart';
import '../../utils/constants.dart';

class CreateCourseScreen extends StatefulWidget {
  const CreateCourseScreen({super.key});

  @override
  State<CreateCourseScreen> createState() => _CreateCourseScreenState();
}

class _CreateCourseScreenState extends State<CreateCourseScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();
  final _durationController = TextEditingController();

  CategoryModel? _selectedCategory;
  String _selectedLevel = 'beginner';
  String _selectedLanguage = 'English';
  bool _isFree = true;

  List<TextEditingController> _requirementControllers = [TextEditingController()];
  List<TextEditingController> _learningControllers = [TextEditingController()];
  List<ModuleData> _modules = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CategoryProvider>(context, listen: false).fetchCategories();
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    _durationController.dispose();
    for (var controller in _requirementControllers) {
      controller.dispose();
    }
    for (var controller in _learningControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addRequirement() {
    setState(() {
      _requirementControllers.add(TextEditingController());
    });
  }

  void _removeRequirement(int index) {
    setState(() {
      _requirementControllers[index].dispose();
      _requirementControllers.removeAt(index);
    });
  }

  void _addLearning() {
    setState(() {
      _learningControllers.add(TextEditingController());
    });
  }

  void _removeLearning(int index) {
    setState(() {
      _learningControllers[index].dispose();
      _learningControllers.removeAt(index);
    });
  }

  void _addModule() {
    showDialog(
      context: context,
      builder: (context) {
        final titleController = TextEditingController();
        final descriptionController = TextEditingController();

        return AlertDialog(
          title: const Text('Add Module'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(
                  labelText: 'Module Title',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descriptionController,
                decoration: const InputDecoration(
                  labelText: 'Description (Optional)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (titleController.text.isNotEmpty) {
                  setState(() {
                    _modules.add(ModuleData(
                      title: titleController.text,
                      description: descriptionController.text,
                      order: _modules.length,
                    ));
                  });
                  Navigator.pop(context);
                }
              },
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }

  void _removeModule(int index) {
    setState(() {
      _modules.removeAt(index);
      // Update order
      for (int i = 0; i < _modules.length; i++) {
        _modules[i].order = i;
      }
    });
  }

  Future<void> _createCourse() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedCategory == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a category'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final courseProvider = Provider.of<CourseProvider>(context, listen: false);

    final requirements = _requirementControllers
        .map((c) => c.text)
        .where((text) => text.isNotEmpty)
        .toList();

    final whatYouWillLearn = _learningControllers
        .map((c) => c.text)
        .where((text) => text.isNotEmpty)
        .toList();

    final modules = _modules
        .map((m) => {
              'title': m.title,
              'description': m.description,
              'order': m.order,
            })
        .toList();

    final success = await courseProvider.createCourse(
      title: _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      categoryId: _selectedCategory!.id,
      price: _isFree ? 0 : double.tryParse(_priceController.text) ?? 0,
      level: _selectedLevel,
      duration: double.tryParse(_durationController.text) ?? 0,
      language: _selectedLanguage,
      modules: modules,
      requirements: requirements,
      whatYouWillLearn: whatYouWillLearn,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Course created successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(courseProvider.error ?? 'Failed to create course'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoryProvider = Provider.of<CategoryProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create New Course'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Basic Information Section
              _buildSectionTitle('Basic Information'),
              const SizedBox(height: 16),

              // Title
              TextFormField(
                controller: _titleController,
                decoration: InputDecoration(
                  labelText: 'Course Title',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter course title';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descriptionController,
                decoration: InputDecoration(
                  labelText: 'Course Description',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                maxLines: 4,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter course description';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Category Dropdown
              DropdownButtonFormField<CategoryModel>(
                initialValue: _selectedCategory,
                decoration: InputDecoration(
                  labelText: 'Category',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: categoryProvider.categories
                    .map((category) => DropdownMenuItem(
                          value: category,
                          child: Text('${category.icon} ${category.name}'),
                        ))
                    .toList(),
                onChanged: (value) {
                  setState(() {
                    _selectedCategory = value;
                  });
                },
                validator: (value) {
                  if (value == null) {
                    return 'Please select a category';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Level
              DropdownButtonFormField<String>(
                initialValue: _selectedLevel,
                decoration: InputDecoration(
                  labelText: 'Level',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: const [
                  DropdownMenuItem(value: 'beginner', child: Text('Beginner')),
                  DropdownMenuItem(
                      value: 'intermediate', child: Text('Intermediate')),
                  DropdownMenuItem(value: 'advanced', child: Text('Advanced')),
                ],
                onChanged: (value) {
                  setState(() {
                    _selectedLevel = value!;
                  });
                },
              ),
              const SizedBox(height: 16),

              // Duration
              TextFormField(
                controller: _durationController,
                decoration: InputDecoration(
                  labelText: 'Duration (hours)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),

              // Language
              DropdownButtonFormField<String>(
                initialValue: _selectedLanguage,
                decoration: InputDecoration(
                  labelText: 'Language',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: const [
                  DropdownMenuItem(value: 'English', child: Text('English')),
                  DropdownMenuItem(value: 'Hindi', child: Text('Hindi')),
                  DropdownMenuItem(value: 'Hinglish', child: Text('Hinglish')),
                ],
                onChanged: (value) {
                  setState(() {
                    _selectedLanguage = value!;
                  });
                },
              ),
              const SizedBox(height: 24),

              // Pricing Section
              _buildSectionTitle('Pricing'),
              const SizedBox(height: 16),

              SwitchListTile(
                title: const Text('Free Course'),
                value: _isFree,
                onChanged: (value) {
                  setState(() {
                    _isFree = value;
                  });
                },
                contentPadding: EdgeInsets.zero,
              ),

              if (!_isFree) ...[
                const SizedBox(height: 16),
                TextFormField(
                  controller: _priceController,
                  decoration: InputDecoration(
                    labelText: 'Price (₹)',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) {
                    if (!_isFree && (value == null || value.isEmpty)) {
                      return 'Please enter price';
                    }
                    return null;
                  },
                ),
              ],
              const SizedBox(height: 24),

              // Course Structure
              _buildSectionTitle('Course Structure'),
              const SizedBox(height: 16),

              if (_modules.isEmpty)
                Center(
                  child: Text(
                    'No modules added yet',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                )
              else
                ..._modules.asMap().entries.map((entry) {
                  final index = entry.key;
                  final module = entry.value;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        child: Text('${index + 1}'),
                      ),
                      title: Text(module.title),
                      subtitle: Text(module.description),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red),
                        onPressed: () => _removeModule(index),
                      ),
                    ),
                  );
                }),

              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _addModule,
                icon: const Icon(Icons.add),
                label: const Text('Add Module'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                ),
              ),
              const SizedBox(height: 24),

              // Requirements
              _buildDynamicList(
                title: 'Requirements',
                controllers: _requirementControllers,
                onAdd: _addRequirement,
                onRemove: _removeRequirement,
              ),
              const SizedBox(height: 24),

              // What You'll Learn
              _buildDynamicList(
                title: 'What You\'ll Learn',
                controllers: _learningControllers,
                onAdd: _addLearning,
                onRemove: _removeLearning,
              ),
              const SizedBox(height: 32),

              // Create Button
              Consumer<CourseProvider>(
                builder: (context, courseProvider, _) {
                  return SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed:
                          courseProvider.isLoading ? null : _createCourse,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: courseProvider.isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Text(
                              'Create Course',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _buildDynamicList({
    required String title,
    required List<TextEditingController> controllers,
    required VoidCallback onAdd,
    required Function(int) onRemove,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(title),
        const SizedBox(height: 16),
        ...controllers.asMap().entries.map((entry) {
          final index = entry.key;
          final controller = entry.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: controller,
                    decoration: InputDecoration(
                      hintText: 'Enter $title',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                if (controllers.length > 1) ...[
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.remove_circle, color: Colors.red),
                    onPressed: () => onRemove(index),
                  ),
                ],
              ],
            ),
          );
        }),
        TextButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add),
          label: Text('Add $title'),
        ),
      ],
    );
  }
}

class ModuleData {
  String title;
  String description;
  int order;

  ModuleData({
    required this.title,
    required this.description,
    required this.order,
  });
}