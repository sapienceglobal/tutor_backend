import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/category_model.dart';
import '../../providers/tutor_provider.dart';
import '../../widgets/tutor_card.dart';

class TutorsByCategoryScreen extends StatefulWidget {
  final CategoryModel category;

  const TutorsByCategoryScreen({super.key, required this.category});

  @override
  State<TutorsByCategoryScreen> createState() => _TutorsByCategoryScreenState();
}

class _TutorsByCategoryScreenState extends State<TutorsByCategoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TutorProvider>(
        context,
        listen: false,
      ).fetchTutorsByCategory(widget.category.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final tutorProvider = Provider.of<TutorProvider>(context);

    return Scaffold(
      appBar: AppBar(title: Text('${widget.category.name} Tutors')),
      body: RefreshIndicator(
        onRefresh: () =>
            tutorProvider.fetchTutorsByCategory(widget.category.id),
        child: tutorProvider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : tutorProvider.tutors.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.category.icon,
                      style: const TextStyle(fontSize: 60),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No tutors found in ${widget.category.name}',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: tutorProvider.tutors.length,
                itemBuilder: (context, index) {
                  final tutor = tutorProvider.tutors[index];
                  return TutorCard(tutor: tutor);
                },
              ),
      ),
    );
  }
}
