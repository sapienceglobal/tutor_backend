// import 'package:flutter/material.dart';
// import '../widgets/unified_player.dart';

// class UnifiedPlayerDemo extends StatefulWidget {
//   const UnifiedPlayerDemo({super.key});

//   @override
//   State<UnifiedPlayerDemo> createState() => _UnifiedPlayerDemoState();
// }

// class _UnifiedPlayerDemoState extends State<UnifiedPlayerDemo> {
//   final TextEditingController _controller = TextEditingController(
//     text: 'https://youtu.be/eDWhbQGMPtU?si=0JuQA96sIi6rycAE', // example
//   );

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       appBar: AppBar(title: const Text('YouTube + MP4 Player')),
//       body: Padding(
//         padding: const EdgeInsets.all(12),
//         child: Column(
//           children: [
//             TextField(
//               controller: _controller,
//               decoration: const InputDecoration(
//                 labelText: 'YouTube or MP4 URL',
//                 border: OutlineInputBorder(),
//               ),
//             ),
//             const SizedBox(height: 12),
//             ElevatedButton.icon(
//               onPressed: () {
//                 FocusScope.of(context).unfocus();
//                 Navigator.push(
//                   context,
//                   MaterialPageRoute(
//                     builder: (_) => UnifiedPlayerScreen(url: _controller.text.trim()),
//                   ),
//                 );
//               },
//               icon: const Icon(Icons.play_circle_fill),
//               label: const Text('Open Player'),
//             ),
//             const SizedBox(height: 20),
//             const Text(
//               'Examples:\n• YouTube: https://youtu.be/eDWhbQGMPtU\n• MP4: https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
//               textAlign: TextAlign.left,
//             ),
//           ],
//         ),
//       ),
//     );
//   }
// }
