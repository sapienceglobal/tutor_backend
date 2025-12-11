import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../../models/lesson_model.dart';
import '../../utils/constants.dart';
import '../../services/progress_service.dart';
import '../../providers/enrollment_provider.dart';

class LessonPlayerScreen extends StatefulWidget {
  final List<LessonModel> lessons;
  final int initialIndex;
  final String courseId;

  const LessonPlayerScreen({
    super.key,
    required this.lessons,
    required this.initialIndex,
    required this.courseId,
  });

  @override
  State<LessonPlayerScreen> createState() => _LessonPlayerScreenState();
}

class _LessonPlayerScreenState extends State<LessonPlayerScreen> {
  // Navigation State
  late int _currentIndex;
  late LessonModel _currentLesson;

  // Video State
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;
  YoutubePlayerController? _youtubeController;

  bool _isLoading = true;
  bool _isMarkingComplete = false;
  bool _isDisposing = false; // Critical flag
  String? _error;
  int _initialPositionSec = 0;

  Timer? _progressTimer;
  VoidCallback? _youtubeListener; // Store listener reference

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _currentLesson = widget.lessons[_currentIndex];

    // Delay initialization to avoid blocking UI
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadLesson(_currentIndex);
    });
  }

  // --- LESSON LOADING LOGIC ---
  Future<bool> _checkNetworkConnectivity() async {
    try {
      final connectivityResult = await Connectivity().checkConnectivity();
      return connectivityResult != ConnectivityResult.none;
    } catch (e) {
      debugPrint('Network check error: $e');
      return true; // Default to true to avoid blocking
    }
  }

  Future<void> _loadLesson(int index) async {
    if (_isDisposing || !mounted) return;

    // Check network first for video lessons
    if (widget.lessons[index].type == 'video') {
      final hasNetwork = await _checkNetworkConnectivity();
      if (!hasNetwork && mounted) {
        setState(() {
          _currentIndex = index;
          _currentLesson = widget.lessons[index];
          _error = 'No internet connection. Please check your network.';
          _isLoading = false;
        });
        return;
      }
    }

    // First dispose old controllers
    await _disposeControllers();

    if (!mounted) return;

    setState(() {
      _currentIndex = index;
      _currentLesson = widget.lessons[index];
      _isLoading = true;
      _error = null;
    });

    try {
      // Fetch progress without blocking UI
      await _fetchServerProgress();

      if (!mounted) return;

      if (_currentLesson.type == 'video') {
        await _initPlayer();
      } else {
        // Non-video content
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load lesson: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _fetchServerProgress() async {
    try {
      final progressData = await ProgressService.getLessonProgress(
        _currentLesson.id,
      );
      if (progressData != null && progressData['lastWatchedPosition'] != null) {
        _initialPositionSec = progressData['lastWatchedPosition'];
      } else {
        _initialPositionSec = 0;
      }
    } catch (_) {
      _initialPositionSec = 0;
    }
  }

  // --- VIDEO PLAYER LOGIC ---
  bool _isYouTubeUrl(String? url) {
    if (url == null) return false;
    return url.contains('youtube.com') || url.contains('youtu.be');
  }

  Future<void> _initPlayer() async {
    if (_isDisposing || !mounted) return;

    final videoUrl = _currentLesson.content.videoUrl;
    if (videoUrl == null) {
      if (mounted) {
        setState(() {
          _error = 'No video URL provided.';
          _isLoading = false;
        });
      }
      return;
    }

    try {
      if (_isYouTubeUrl(videoUrl)) {
        await _initYoutubePlayer(videoUrl);
      } else {
        await _initDirectVideoPlayer(videoUrl);
      }

      // Start periodic sync only after successful initialization
      if (mounted && !_isDisposing) {
        _startProgressSync();
        setState(() => _isLoading = false);
      }
    } catch (e) {
      debugPrint('Player init error: $e');
      if (mounted && !_isDisposing) {
        setState(() {
          _error = 'Failed to load video: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _initYoutubePlayer(String videoUrl) async {
    final videoId = YoutubePlayer.convertUrlToId(videoUrl);
    if (videoId == null) throw Exception('Invalid YouTube URL');

    _youtubeController = YoutubePlayerController(
      initialVideoId: videoId,
      flags: const YoutubePlayerFlags(
        autoPlay: true,
        mute: false,
        enableCaption: true,
        forceHD: false,
      ),
    );

    // Create listener for seeking
    if (_initialPositionSec > 0) {
      bool hasSeekCompleted = false;
      _youtubeListener = () {
        if (!hasSeekCompleted &&
            _youtubeController != null &&
            _youtubeController!.value.isReady) {
          hasSeekCompleted = true;
          _youtubeController!.seekTo(Duration(seconds: _initialPositionSec));
          _initialPositionSec = 0;

          // Remove listener after seeking
          if (_youtubeListener != null) {
            _youtubeController?.removeListener(_youtubeListener!);
            _youtubeListener = null;
          }
        }
      };
      _youtubeController!.addListener(_youtubeListener!);
    }
  }

  Future<void> _initDirectVideoPlayer(String videoUrl) async {
    // Initialize in try-catch to handle network errors
    _videoPlayerController = VideoPlayerController.networkUrl(
      Uri.parse(videoUrl),
    );

    // Add timeout to prevent infinite loading
    await _videoPlayerController!.initialize().timeout(
      const Duration(seconds: 30),
      onTimeout: () {
        throw Exception('Video loading timeout');
      },
    );

    if (!mounted || _isDisposing) return;

    // Seek to last position
    if (_initialPositionSec > 0) {
      await _videoPlayerController!.seekTo(
        Duration(seconds: _initialPositionSec),
      );
    }

    // Create Chewie controller
    _chewieController = ChewieController(
      videoPlayerController: _videoPlayerController!,
      autoPlay: true,
      looping: false,
      aspectRatio: _videoPlayerController!.value.aspectRatio,
      errorBuilder: (context, errorMessage) {
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 48),
              const SizedBox(height: 16),
              Text(
                errorMessage,
                style: const TextStyle(color: Colors.white),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      },
      materialProgressColors: ChewieProgressColors(
        playedColor: AppColors.primary,
        handleColor: AppColors.primary,
        backgroundColor: Colors.grey,
        bufferedColor: Colors.grey[300]!,
      ),
    );
  }

  void _startProgressSync() {
    _progressTimer?.cancel();
    _progressTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      if (!_isDisposing && mounted) {
        _syncProgressToServer();
      }
    });
  }

  Future<void> _syncProgressToServer({bool completed = false}) async {
    if (_currentLesson.type != 'video' || _isDisposing) return;

    int currentPos = 0;
    try {
      if (_youtubeController != null && _youtubeController!.value.isReady) {
        currentPos = _youtubeController!.value.position.inSeconds;
      } else if (_videoPlayerController != null &&
          _videoPlayerController!.value.isInitialized) {
        currentPos = _videoPlayerController!.value.position.inSeconds;
      }

      if (currentPos > 0) {
        await ProgressService.updateProgress(
          courseId: widget.courseId,
          lessonId: _currentLesson.id,
          lastWatchedPosition: currentPos,
          timeSpent: currentPos,
          completed: completed,
        );
      }
    } catch (e) {
      debugPrint('Progress sync error: $e');
    }
  }

  Future<void> _disposeControllers() async {
    _isDisposing = true;

    // Cancel timer first
    _progressTimer?.cancel();
    _progressTimer = null;

    // Save progress before disposing (with error handling)
    try {
      if (_currentLesson.type == 'video') {
        await _syncProgressToServer().timeout(const Duration(seconds: 5));
      }
    } catch (e) {
      debugPrint('Final progress sync failed: $e');
    }

    // Remove YouTube listener
    if (_youtubeListener != null && _youtubeController != null) {
      try {
        _youtubeController!.removeListener(_youtubeListener!);
      } catch (_) {}
      _youtubeListener = null;
    }

    // Dispose Chewie (wrapper) - NO AWAIT
    if (_chewieController != null) {
      try {
        _chewieController!.dispose();
      } catch (e) {
        debugPrint('Chewie dispose error: $e');
      }
      _chewieController = null;
    }

    // Dispose Video Player
    if (_videoPlayerController != null) {
      try {
        await _videoPlayerController!.pause();
        await _videoPlayerController!.dispose();
      } catch (e) {
        debugPrint('Video dispose error: $e');
      }
      _videoPlayerController = null;
    }

    // Dispose YouTube - NO AWAIT
    if (_youtubeController != null) {
      try {
        _youtubeController!.dispose();
      } catch (e) {
        debugPrint('YouTube dispose error: $e');
      }
      _youtubeController = null;
    }

    _isDisposing = false;
  }

  // --- NAVIGATION ACTIONS ---
  void _onNextLesson() async {
    if (_currentIndex < widget.lessons.length - 1) {
      await _loadLesson(_currentIndex + 1);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You have reached the end of the course!'),
          ),
        );
      }
    }
  }

  void _onPreviousLesson() async {
    if (_currentIndex > 0) {
      await _loadLesson(_currentIndex - 1);
    }
  }

  Future<void> _onCompleteAndNext() async {
    if (_isMarkingComplete || !mounted) return;

    setState(() => _isMarkingComplete = true);

    try {
      final success = await ProgressService.updateProgress(
        courseId: widget.courseId,
        lessonId: _currentLesson.id,
        completed: true,
        timeSpent: 60,
      );

      if (!mounted) return;

      setState(() => _isMarkingComplete = false);

      if (success) {
        // Refresh provider
        Provider.of<EnrollmentProvider>(
          context,
          listen: false,
        ).refreshCourseProgress(widget.courseId);

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Lesson completed!'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 1),
          ),
        );

        // Navigate to next
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) _onNextLesson();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update progress. Check internet.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isMarkingComplete = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _openExternalLink(String? url) async {
    if (url == null) return;
    final uri = Uri.parse(url);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Could not open link')));
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _isDisposing = true;
    _disposeControllers();
    super.dispose();
  }

  // --- UI BUILD METHODS ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _currentLesson.type == 'video'
                  ? _buildVideoLayout()
                  : _buildNonVideoLayout(),
            ),
            _buildBottomBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoLayout() {
    return Column(
      children: [
        Container(
          width: double.infinity,
          height: 220,
          color: Colors.black,
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                )
              : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: Colors.red,
                          size: 48,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _error!,
                          style: const TextStyle(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () => _loadLesson(_currentIndex),
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : _buildPlayerWidget(),
        ),
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildLessonInfo(),
                const Divider(),
                _buildAttachmentsList(),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildNonVideoLayout() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            color: Colors.grey[50],
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => Navigator.pop(context),
                ),
                Text(
                  _currentLesson.type.toUpperCase(),
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(40.0),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_currentLesson.type == 'quiz')
            _buildQuizUI()
          else
            Column(
              children: [
                _buildLessonInfo(),
                const Divider(),
                _buildAttachmentsList(),
                _buildDocumentList(),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildPlayerWidget() {
    if (_youtubeController != null) {
      return YoutubePlayer(
        controller: _youtubeController!,
        showVideoProgressIndicator: true,
        progressIndicatorColor: AppColors.primary,
      );
    } else if (_chewieController != null) {
      return Chewie(controller: _chewieController!);
    }
    return const SizedBox.shrink();
  }

  Widget _buildLessonInfo() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  _currentLesson.title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ),
              if (_currentLesson.type == 'video' &&
                  _currentLesson.content.videoUrl != null)
                IconButton(
                  icon: const Icon(Icons.open_in_new, color: Colors.grey),
                  onPressed: () =>
                      _openExternalLink(_currentLesson.content.videoUrl),
                  tooltip: 'Open Externally',
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_currentLesson.content.duration != null)
            Row(
              children: [
                const Icon(Icons.access_time, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  '${(_currentLesson.content.duration! / 60).toStringAsFixed(0)} mins',
                  style: const TextStyle(color: Colors.grey),
                ),
              ],
            ),
          const SizedBox(height: 16),
          if (_currentLesson.description.isNotEmpty)
            Text(
              _currentLesson.description,
              style: TextStyle(
                fontSize: 15,
                color: Colors.grey[700],
                height: 1.5,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAttachmentsList() {
    final attachments = _currentLesson.content.attachments;
    if (attachments.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Resources',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          ...attachments.map(
            (file) => Card(
              elevation: 0,
              color: Colors.grey[100],
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: Icon(
                  Icons.insert_drive_file,
                  color: AppColors.primary,
                ),
                title: Text(
                  file.name,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                subtitle: Text(file.type.toUpperCase()),
                trailing: const Icon(Icons.download_rounded),
                onTap: () => _openExternalLink(file.url),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentList() {
    if (_currentLesson.type != 'document') return const SizedBox.shrink();
    final docs = _currentLesson.content.documents;
    if (docs.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 16),
          const Text(
            'Documents',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          ...docs.map(
            (doc) => Card(
              elevation: 2,
              shadowColor: Colors.black12,
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                contentPadding: const EdgeInsets.all(12),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.description, color: Colors.blue),
                ),
                title: Text(
                  doc.name,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: Text(
                  '${doc.type.toUpperCase()} • ${((doc.size ?? 0) / 1024).toStringAsFixed(1)} KB',
                ),
                trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                onTap: () => _openExternalLink(doc.url),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuizUI() {
    final quiz = _currentLesson.content.quiz;
    if (quiz == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.quiz, size: 80, color: Colors.orange),
          const SizedBox(height: 24),
          Text(
            quiz.title ?? 'Quiz Time!',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Starting Quiz...')),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Start Quiz',
                style: TextStyle(fontSize: 18, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final hasNext = _currentIndex < widget.lessons.length - 1;
    final hasPrev = _currentIndex > 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Row(
        children: [
          if (hasPrev)
            OutlinedButton(
              onPressed: _onPreviousLesson,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                side: BorderSide(color: Colors.grey[300]!),
              ),
              child: const Icon(
                Icons.arrow_back_ios,
                size: 16,
                color: Colors.black,
              ),
            ),
          if (hasPrev) const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: _isMarkingComplete ? null : _onCompleteAndNext,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: _isMarkingComplete
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(color: Colors.white),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          hasNext ? 'Complete & Next' : 'Finish Course',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (hasNext) ...[
                          const SizedBox(width: 8),
                          const Icon(
                            Icons.arrow_forward,
                            color: Colors.white,
                            size: 18,
                          ),
                        ],
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
