import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

// Set the ffmpeg executable path explicitly
ffmpeg.setFfmpegPath(ffmpegInstaller);

/**
 * 
 * @param {string} inputPath - Absolute path to the uploaded raw video
 * @param {string} outputBaseDir - Absolute path to the base HLS directory
 * @param {string} fileId - Unique ID for this video (creates a folder for its chunks)
 * @returns {Promise} Resolves with the relative URL to the m3u8 playlist
 */
export const processVideoForHLS = (inputPath, outputBaseDir, fileId) => {
    return new Promise((resolve, reject) => {
        // Create the specific directory for this video's HLS files
        const hlsDir = path.join(outputBaseDir, fileId);
        if (!fs.existsSync(hlsDir)) {
            fs.mkdirSync(hlsDir, { recursive: true });
        }

        const outputPath = path.join(hlsDir, 'index.m3u8');

        console.log(`Starting FFMPEG transcoding for: ${fileId}`);

        ffmpeg(inputPath, { timeout: 432000 }) // Long timeout for large files
            .addOptions([
                '-profile:v baseline', // Compatible profile
                '-level 3.0',
                '-start_number 0',     // Segment index
                '-hls_time 10',        // 10-second segments
                '-hls_list_size 0',    // Keep all segments in the playlist (VOD)
                '-f hls'               // Explicitly declare HLS format
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`HLS processing successfully finished for: ${fileId}`);
                resolve({
                    success: true,
                    // The frontend will request this path from the static server
                    playlistUrl: `/uploads/hls/${fileId}/index.m3u8`,
                    hlsDir
                });
            })
            .on('error', (err, stdout, stderr) => {
                console.error(`FFMPEG Error processing ${fileId}:`, err.message);
                console.error(`STDERR:`, stderr);
                reject(err);
            })
            .run();
    });
};
