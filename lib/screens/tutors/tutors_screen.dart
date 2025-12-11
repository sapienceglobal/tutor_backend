import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/tutor_provider.dart';
import '../../widgets/tutor_card.dart';

class TutorsScreen extends StatefulWidget {
  const TutorsScreen({super.key});

  @override
  State<TutorsScreen> createState() => _TutorsScreenState();
}

class _TutorsScreenState extends State<TutorsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TutorProvider>(context, listen: false).fetchTutors();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tutorProvider = Provider.of<TutorProvider>(context);

    return Scaffold(
      appBar: AppBar(title: const Text('All Tutors')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search tutors...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.grey[100],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (value) {
                tutorProvider.searchTutors(value);
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => tutorProvider.fetchTutors(),
              child: tutorProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : tutorProvider.tutors.isEmpty
                  ? const Center(child: Text('No tutors found'))
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: tutorProvider.tutors.length,
                      itemBuilder: (context, index) {
                        final tutor = tutorProvider.tutors[index];
                        return TutorCard(tutor: tutor);
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
