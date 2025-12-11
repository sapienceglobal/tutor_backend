// import 'dart:async';
// import 'package:flutter/foundation.dart';
// import 'package:flutter/material.dart';
// import 'package:video_player/video_player.dart';
// import 'package:chewie/chewie.dart';
// import 'package:youtube_player_iframe/youtube_player_iframe.dart';

// enum _PlayerType { youtube, mp4, unknown }

// class UnifiedPlayerScreen extends StatefulWidget {
//   final String url;
//   const UnifiedPlayerScreen({super.key, required this.url});

//   @override
//   State<UnifiedPlayerScreen> createState() => _UnifiedPlayerScreenState();
// }

// class _UnifiedPlayerScreenState extends State<UnifiedPlayerScreen> {
//   _PlayerType _type = _PlayerType.unknown;
//   String? _youtubeId;

//   // MP4
//   VideoPlayerController? _videoController;
//   ChewieController? _chewieController;

//   // YouTube
//   YoutubePlayerController? _ytController;

//   bool _isInitializing = true;
//   String? _error;

//   @override
//   void initState() {
//     super.initState();
//     _initializeForUrl(widget.url);
//   }

//   @override
//   void didUpdateWidget(covariant UnifiedPlayerScreen oldWidget) {
//     super.didUpdateWidget(oldWidget);
//     if (oldWidget.url != widget.url) {
//       _disposeControllers();
//       _initializeForUrl(widget.url);
//     }
//   }

//   @override
//   void dispose() {
//     _disposeControllers();
//     super.dispose();
//   }

//   void _disposeControllers() {
//     _videoController?.pause();
//     _videoController?.dispose();
//     _chewieController?.dispose();
//     _ytController?.close();
//     _videoController = null;
//     _chewieController = null;
//     _ytController = null;
//   }

//   Future<void> _initializeForUrl(String url) async {
//     setState(() {
//       _isInitializing = true;
//       _error = null;
//       _type = _PlayerType.unknown;
//       _youtubeId = null;
//     });

//     try {
//       final type = _detectType(url);
//       if (type == _PlayerType.youtube) {
//         _type = _PlayerType.youtube;
//         _youtubeId = _extractYoutubeId(url);
//         if (_youtubeId == null || _youtubeId!.isEmpty) {
//           throw Exception('Invalid YouTube URL or unable to extract video id.');
//         }
//         // Setup youtube_iframe controller
//         _ytController = YoutubePlayerController(
//           initialVideoId: _youtubeId!,
//           params: const YoutubePlayerParams(
//             showControls: true,
//             showFullscreenButton: true,
//             desktopMode: false,
//             privacyEnhanced: true,
//             enableCaption: true,
//           ),
//         );
//         // small delay to ensure controller attaches
//         await Future.delayed(const Duration(milliseconds: 200));
//       } else if (type == _PlayerType.mp4) {
//         _type = _PlayerType.mp4;
//         // Initialize video_player
//         _videoController = VideoPlayerController.network(
//           url,
//           videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
//         );
//         await _videoController!.initialize();
//         _chewieController = ChewieController(
//           videoPlayerController: _videoController!,
//           autoPlay: true,
//           looping: false,
//           allowPlaybackSpeedChanging: true,
//           allowFullScreen: true,
//           showControls: true,
//           materialProgressColors: ChewieProgressColors(
//             playedColor: Colors.indigo,
//             handleColor: Colors.indigo,
//             backgroundColor: Colors.grey,
//             bufferedColor: Colors.grey[300]!,
//           ),
//         );
//       } else {
//         throw Exception('Unsupported or unknown URL type.');
//       }

//       if (mounted) {
//         setState(() {
//           _isInitializing = false;
//         });
//       }
//     } catch (e) {
//       if (mounted) {
//         setState(() {
//           _isInitializing = false;
//           _error = e.toString();
//         });
//       }
//     }
//   }

//   _PlayerType _detectType(String url) {
//     final lower = url.toLowerCase();
//     if (lower.contains('youtube.com') ||
//         lower.contains('youtu.be') ||
//         lower.contains('youtube.googleapis.com')) {
//       return _PlayerType.youtube;
//     }
//     // naive mp4 detection - checks extension or common CDN pattern
//     if (lower.endsWith('.mp4') ||
//         lower.contains('.mp4?') ||
//         lower.contains('content/videos') ||
//         lower.contains('cdn')) {
//       return _PlayerType.mp4;
//     }
//     // Try to treat https URLs serving direct video streams as mp4
//     if (lower.startsWith('http') &&
//         (lower.contains('.m3u8') || lower.contains('.mpd'))) {
//       // NOTE: chewie/video_player does not natively handle HLS (.m3u8) on some Android devices without additional config.
//       // For HLS you may need better player or platform implementations. We'll still try to play.
//       return _PlayerType.mp4;
//     }
//     return _PlayerType.unknown;
//   }

//   String? _extractYoutubeId(String url) {
//     if (url.isEmpty) return null;
//     // Common patterns handled: youtu.be/ID, v=ID, /embed/ID, /shorts/ID
//     final patterns = [
//       RegExp(r'youtu\.be\/([^\?\&\/]+)'),
//       RegExp(r'v=([^\?\&\/]+)'),
//       RegExp(r'\/embed\/([^\?\&\/]+)'),
//       RegExp(r'\/shorts\/([^\?\&\/]+)'),
//     ];
//     for (final re in patterns) {
//       final match = re.firstMatch(url);
//       if (match != null && match.groupCount >= 1) {
//         return match.group(1);
//       }
//     }
//     // Last attempt: look for the last path segment
//     try {
//       final uri = Uri.parse(url);
//       final last = uri.pathSegments.isNotEmpty ? uri.pathSegments.last : '';
//       if (last.isNotEmpty && last.length >= 6) return last;
//     } catch (_) {}
//     return null;
//   }

//   Widget _buildBody() {
//     if (_isInitializing) {
//       return const Center(child: CircularProgressIndicator());
//     }
//     if (_error != null) {
//       return Center(
//         child: Padding(
//           padding: const EdgeInsets.all(16),
//           child: Text(
//             'Error: $_error',
//             style: const TextStyle(color: Colors.red),
//           ),
//         ),
//       );
//     }

//     if (_type == _PlayerType.youtube && _ytController != null) {
//       // YoutubePlayerIFrame handles fullscreen itself
//       return Column(
//         children: [
//           AspectRatio(
//             aspectRatio: 16 / 9,
//             child: YoutubePlayerIFrame(controller: _ytController!),
//           ),
//           const SizedBox(height: 12),
//           // Basic info & controls (seek, play/pause)
//           Padding(
//             padding: const EdgeInsets.symmetric(horizontal: 12),
//             child: Row(
//               children: [
//                 ElevatedButton.icon(
//                   onPressed: () => _ytController!.play(),
//                   icon: const Icon(Icons.play_arrow),
//                   label: const Text('Play'),
//                 ),
//                 const SizedBox(width: 8),
//                 ElevatedButton.icon(
//                   onPressed: () => _ytController!.pause(),
//                   icon: const Icon(Icons.pause),
//                   label: const Text('Pause'),
//                 ),
//                 const SizedBox(width: 8),
//                 ElevatedButton.icon(
//                   onPressed: () =>
//                       _ytController!.seekTo(const Duration(seconds: 0)),
//                   icon: const Icon(Icons.replay),
//                   label: const Text('Restart'),
//                 ),
//                 const Spacer(),
//                 IconButton(
//                   onPressed: () => _ytController!.toggleFullScreen(),
//                   icon: const Icon(Icons.fullscreen),
//                 ),
//               ],
//             ),
//           ),
//         ],
//       );
//     }

//     if (_type == _PlayerType.mp4 && _chewieController != null) {
//       return Column(
//         children: [
//           AspectRatio(
//             aspectRatio: _videoController!.value.aspectRatio > 0
//                 ? _videoController!.value.aspectRatio
//                 : 16 / 9,
//             child: Chewie(controller: _chewieController!),
//           ),
//           const SizedBox(height: 12),
//           // Additional metadata
//           Padding(
//             padding: const EdgeInsets.symmetric(horizontal: 12),
//             child: Row(
//               children: [
//                 Text(
//                   _videoController!.value.isInitialized
//                       ? '${(_videoController!.value.duration.inSeconds / 60).toStringAsFixed(1)} min'
//                       : '—',
//                 ),
//                 const Spacer(),
//                 IconButton(
//                   onPressed: () {
//                     if (_videoController!.value.isPlaying) {
//                       _videoController!.pause();
//                     } else {
//                       _videoController!.play();
//                     }
//                     setState(() {});
//                   },
//                   icon: Icon(
//                     _videoController!.value.isPlaying
//                         ? Icons.pause
//                         : Icons.play_arrow,
//                   ),
//                 ),
//               ],
//             ),
//           ),
//         ],
//       );
//     }

//     return const Center(child: Text('Unsupported media type'));
//   }

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       appBar: AppBar(
//         title: Text(
//           _type == _PlayerType.youtube
//               ? 'YouTube Player'
//               : _type == _PlayerType.mp4
//               ? 'Video Player'
//               : 'Player',
//         ),
//       ),
//       body: SafeArea(child: _buildBody()),
//     );
//   }
// }
