const SITE_CONFIG = {
    owner: "PolynesianPvnk",
    repo: "shido.github.io",
    branch: "main",
    contactEmail: "your.email@example.com",
    live: {
        playerEmbed: "",
        chatEmbed: "",
        vods: [
            {
                title: "VOD archive placeholder",
                date: "Add date",
                url: "#"
            }
        ]
    }
};

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".flac"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MUSIC_FOLDERS = [
    { label: "Singles", path: "Music/Singles" },
    { label: "EPs", path: "Music/EPs" },
    { label: "Albums and Mixtapes", path: "Music/Albums and Mixtapes", fallbackPath: "Music/Albums and Mixtales" },
    { label: "Compilations", path: "Music/Compilations" }
];

document.addEventListener("DOMContentLoaded", () => {
    const year = document.querySelector("#year");
    if (year) year.textContent = new Date().getFullYear();

    loadMusicLibrary();
    loadBeatStore();
    loadLiveSection();
});

async function githubContents(path) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${SITE_CONFIG.owner}/${SITE_CONFIG.repo}/contents/${encodedPath}?ref=${SITE_CONFIG.branch}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
}

async function listFilesRecursive(path) {
    const items = await githubContents(path);
    const files = [];
    for (const item of items) {
        if (item.type === "file") files.push(item);
        if (item.type === "dir") {
            const nested = await listFilesRecursive(item.path);
            files.push(...nested);
        }
    }
    return files;
}

async function loadFolderWithFallback(folder) {
    try {
        return await listFilesRecursive(folder.path);
    } catch (error) {
        if (!folder.fallbackPath) return [];
        try {
            return await listFilesRecursive(folder.fallbackPath);
        } catch {
            return [];
        }
    }
}

function hasExtension(file, extensions) {
    return extensions.some(ext => file.name.toLowerCase().endsWith(ext));
}

function basename(fileName) {
    return fileName.replace(/\.[^/.]+$/, "");
}

function prettyName(fileName) {
    return basename(fileName).replace(/[-_]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

async function metadataFor(audioFile, files) {
    const audioBase = basename(audioFile.name).toLowerCase();
    const folderFiles = files.filter(file => file.path.substring(0, file.path.lastIndexOf("/")) === audioFile.path.substring(0, audioFile.path.lastIndexOf("/")));
    const jsonFile = folderFiles.find(file => file.name.toLowerCase() === `${audioBase}.json`) || folderFiles.find(file => file.name.toLowerCase() === "metadata.json");
    let metadata = {};

    if (jsonFile) {
        try {
            const response = await fetch(jsonFile.download_url);
            metadata = await response.json();
        } catch {
            metadata = {};
        }
    }

    const coverName = metadata.cover ? metadata.cover.toLowerCase() : "";
    const coverFile = folderFiles.find(file => coverName && file.name.toLowerCase() === coverName)
        || folderFiles.find(file => hasExtension(file, IMAGE_EXTENSIONS) && basename(file.name).toLowerCase() === audioBase)
        || folderFiles.find(file => hasExtension(file, IMAGE_EXTENSIONS) && file.name.toLowerCase().includes("cover"))
        || folderFiles.find(file => hasExtension(file, IMAGE_EXTENSIONS));

    return {
        title: metadata.title || prettyName(audioFile.name),
        artist: metadata.artist || metadata.producer || "X/i\\D",
        album: metadata.album || "",
        bpm: metadata.bpm || "",
        key: metadata.key || "",
        price: metadata.price || "",
        license: metadata.license || "",
        paymentUrl: metadata.paymentUrl || metadata.paypal || metadata.stripe || "",
        audioUrl: audioFile.download_url,
        coverUrl: coverFile ? coverFile.download_url : "",
        path: audioFile.path
    };
}

async function buildTracks(folder) {
    const files = await loadFolderWithFallback(folder);
    const audioFiles = files.filter(file => hasExtension(file, AUDIO_EXTENSIONS));
    const tracks = await Promise.all(audioFiles.map(file => metadataFor(file, files)));
    return tracks.map(track => ({ ...track, category: folder.label }));
}

async function loadMusicLibrary() {
    const library = document.querySelector("#music-library");
    if (!library) return;

    library.innerHTML = "<p class=\"muted\">Loading music from GitHub...</p>";
    const allGroups = await Promise.all(MUSIC_FOLDERS.map(buildTracks));
    const tracks = allGroups.flat();
    const limit = Number(library.dataset.limit || 0);
    const visibleTracks = limit ? tracks.slice(0, limit) : tracks;

    if (!visibleTracks.length) {
        library.innerHTML = "<p class=\"muted\">No music files found yet. Upload audio files and cover art to the Music folders, then publish the repo.</p>";
        return;
    }

    setupTabs(tracks);
    renderTracks(visibleTracks, library);
    setupFeatured(tracks[0]);
}

function setupTabs(tracks) {
    const tabs = document.querySelector("#music-tabs");
    if (!tabs) return;

    const categories = ["All", ...new Set(tracks.map(track => track.category))];
    tabs.innerHTML = categories.map((category, index) => `<button class="button ${index === 0 ? "active" : ""}" type="button" data-category="${category}">${category}</button>`).join("");

    tabs.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        tabs.querySelectorAll("button").forEach(tab => tab.classList.remove("active"));
        button.classList.add("active");
        const category = button.dataset.category;
        const filtered = category === "All" ? tracks : tracks.filter(track => track.category === category);
        renderTracks(filtered, document.querySelector("#music-library"));
    });
}

function renderTracks(tracks, container) {
    const hasDockedPlayer = Boolean(document.querySelector("#main-audio"));
    container.innerHTML = tracks.map((track, index) => `
        <article class="release-card">
            ${track.coverUrl ? `<img src="${track.coverUrl}" alt="${track.title} cover art">` : ""}
            <div class="card-body">
                <h3>${track.title}</h3>
                <p class="card-meta">${[track.artist, track.album, track.category].filter(Boolean).join(" / ")}</p>
                ${hasDockedPlayer ? `<button class="button primary" type="button" data-track-index="${index}">Play</button>` : `<audio controls preload="metadata" src="${track.audioUrl}"></audio>`}
            </div>
        </article>
    `).join("");

    container.querySelectorAll("[data-track-index]").forEach(button => {
        button.addEventListener("click", () => setPlayerTrack(tracks[Number(button.dataset.trackIndex)]));
    });
}

function setupFeatured(track) {
    const featuredPlayer = document.querySelector("#featured-player");
    const featuredTitle = document.querySelector("#featured-title");
    if (!featuredPlayer || !track) return;
    featuredPlayer.src = track.audioUrl;
    if (featuredTitle) featuredTitle.textContent = `${track.title} - ${track.artist}`;
}

function setPlayerTrack(track) {
    const audio = document.querySelector("#main-audio");
    const title = document.querySelector("#player-title");
    const meta = document.querySelector("#player-meta");
    const art = document.querySelector("#player-art");
    if (!audio) return;

    audio.src = track.audioUrl;
    audio.play().catch(() => {});
    if (title) title.textContent = track.title;
    if (meta) meta.textContent = [track.artist, track.album, track.category].filter(Boolean).join(" / ");
    if (art && track.coverUrl) {
        art.src = track.coverUrl;
        art.alt = `${track.title} cover art`;
        art.hidden = false;
    }
}

async function loadBeatStore() {
    const containers = [document.querySelector("#beat-store"), document.querySelector("#beats-preview")].filter(Boolean);
    if (!containers.length) return;

    containers.forEach(container => {
        container.innerHTML = "<p class=\"muted\">Loading beats from GitHub...</p>";
    });

    let files = [];
    try {
        files = await listFilesRecursive("Beats");
    } catch {
        files = [];
    }

    const audioFiles = files.filter(file => hasExtension(file, AUDIO_EXTENSIONS));
    const beats = await Promise.all(audioFiles.map(file => metadataFor(file, files)));

    containers.forEach(container => {
        const list = container.id === "beats-preview" ? beats.slice(0, 4) : beats;
        renderBeats(list, container);
    });
}

function renderBeats(beats, container) {
    if (!beats.length) {
        container.innerHTML = "<p class=\"muted\">No beats found yet. Add audio files to the Beats folder and publish the repo.</p>";
        return;
    }

    container.innerHTML = beats.map(beat => `
        <article class="beat-card">
            ${beat.coverUrl ? `<img src="${beat.coverUrl}" alt="${beat.title} cover art">` : ""}
            <div class="card-body">
                <h3>${beat.title}</h3>
                <p class="card-meta">${[beat.bpm && `${beat.bpm} BPM`, beat.key, beat.license].filter(Boolean).join(" / ") || "License details coming soon"}</p>
                <audio controls preload="metadata" src="${beat.audioUrl}"></audio>
                <a class="button primary" href="${beat.paymentUrl || `mailto:${SITE_CONFIG.contactEmail}?subject=Beat license: ${encodeURIComponent(beat.title)}`}">${beat.price ? `Buy ${beat.price}` : "Request License"}</a>
            </div>
        </article>
    `).join("");
}

function loadLiveSection() {
    const player = document.querySelector("#live-player");
    const chat = document.querySelector("#live-chat");
    const vods = document.querySelector("#vod-archives");

    if (player && SITE_CONFIG.live.playerEmbed) player.innerHTML = SITE_CONFIG.live.playerEmbed;
    if (chat && SITE_CONFIG.live.chatEmbed) chat.innerHTML = SITE_CONFIG.live.chatEmbed;
    if (vods) {
        vods.innerHTML = SITE_CONFIG.live.vods.map(vod => `
            <a class="link-tile" href="${vod.url}">
                <strong>${vod.title}</strong>
                <span class="muted">${vod.date}</span>
            </a>
        `).join("");
    }
}
