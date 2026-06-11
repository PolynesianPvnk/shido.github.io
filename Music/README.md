# Music Library Uploads

The music player scans these folders:

- `Music/Singles`
- `Music/EPs`
- `Music/Albums and Mixtapes`
- `Music/Compilations`

Each release can be a folder containing audio, cover art, and metadata:

```text
Music/Singles/My Song/
  my-song.mp3
  cover.jpg
  metadata.json
```

Example metadata for Singles:

```json
{
  "title": "My Song",
  "artist": "X/i\\D",
  "album": "Single",
  "cover": "cover.jpg"
}
```

Example metadata for EPs, Albums, and Compilations:

```json
{
  "title": "My Song",
  "artist": "X/i\\D",
  "album": "Project Name",
  "cover": "cover.jpg",
  "trackNumber": 1
}
```

Supported audio formats: MP3, WAV, M4A, FLAC.
