// CONFIG (PASTE KEYS)
const firebaseConfig = {
  apiKey: "AIzaSyA2iHrUt8_xxvB2m8-LftaE9sg_5JaiFk8",
  authDomain: "banty-live.firebaseapp.com",
  projectId: "banty-live",
  storageBucket: "banty-live.firebasestorage.app",
  messagingSenderId: "435477036444",
  appId: "1:435477036444:web:207931e07ea52ca3269c59",
  measurementId: "G-HXMVFK1E1C"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 1. SEARCH ---
function toggleSearch() {
    const s = document.getElementById('search-ui');
    s.classList.toggle('active');
    if(s.classList.contains('active')) {
        document.getElementById('search-inp').value = "";
        document.getElementById('search-inp').focus();
    } else renderGrid(allData);
}
document.getElementById('search-inp').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = allData.filter(d => d.title.toLowerCase().includes(val));
    renderGrid(filtered);
});

// --- 2. DYNAMIC ISLAND ---
const notifSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
db.collection("island_alerts").orderBy("time", "desc").limit(1).onSnapshot(snap => {
    snap.docChanges().forEach(c => {
        if(c.type === 'added' && Date.now() - c.doc.data().time < 10000) {
            triggerIsland(c.doc.data());
        }
    });
});
function triggerIsland(d) {
    const el = document.getElementById('island-wrap');
    document.getElementById('di-title').innerText = d.title;
    document.getElementById('di-msg').innerText = d.msg;
    el.classList.add('active');
    notifSound.play().catch(()=>{});
    setTimeout(() => el.classList.remove('active'), 6000);
}

// --- 3. WHATSAPP TOAST ---
function showWa() {
    const t = document.getElementById('wa-popup');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 5000);
}
setInterval(showWa, 1500000);
setTimeout(showWa, 15000);

// --- 4. DATA LOGIC ---
let allData = [];
let curCat = 'All';

// Cats
db.collection("categories").onSnapshot(s => {
    const t = document.getElementById('cat-tabs');
    t.innerHTML = `<div class="tab active" onclick="filter('All', this)">All Events</div>`;
    s.forEach(d => {
        const n = d.data().name;
        t.innerHTML += `<div class="tab" onclick="filter('${n}', this)">${n}</div>`;
    });
});

function filter(c, btn) {
    curCat = c;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(c === 'All' ? allData : allData.filter(d => d.category === c));
}

// Matches
db.collection("matches").orderBy("time", "desc").onSnapshot(s => {
    allData = [];
    s.forEach(doc => allData.push(doc.data()));
    if(!document.getElementById('search-ui').classList.contains('active')) renderGrid(allData);
});

function renderGrid(data) {
    const g = document.getElementById('grid');
    g.innerHTML = "";
    if(data.length === 0) { g.innerHTML = '<p style="padding:20px; color:gray;">No matches found.</p>'; return; }

    data.forEach(d => {
        const div = document.createElement('div');
        div.className = 'card';
        div.onclick = () => openPlayer(d);
        div.innerHTML = `
            <img src="${d.poster}" class="poster" onerror="this.src='https://via.placeholder.com/300x160'">
            <div class="c-body">
                <div class="c-title">${d.title}</div>
                <div class="c-meta">
                    <span class="live-txt">● LIVE</span>
                    <span>${d.streams ? d.streams.length : 1} Source</span>
                </div>
            </div>`;
        g.appendChild(div);
    });
}

// Slider
const slider = document.getElementById('slider');
db.collection("slider").orderBy("time", "desc").onSnapshot(s => {
    slider.innerHTML = "";
    s.forEach(d => {
        const div = document.createElement('div');
        div.className = 'slide';
        div.style.backgroundImage = `url('${d.data().img}')`;
        if(d.data().link) div.onclick = () => openPlayer({title:d.data().title, streams:[{lbl:'HD', url:d.data().link}]});
        div.innerHTML = `<div class="slide-overlay"><span class="slide-tag">HOT</span><div class="slide-title">${d.data().title}</div></div>`;
        slider.appendChild(div);
    });
});

// --- 5. SMART PLAYER ENGINE (THE FIX) ---
var player = videojs('v-player', { fluid: true, html5: { hls: { overrideNative: true } } });
let viewInt;
let currentUrl = "";

// Auto-switch to Iframe if VideoJS fails
player.on('error', function() {
    console.log("VideoJS Error. Switching to Iframe mode...");
    // Hide VideoJS, Show Iframe with same URL
    document.querySelector('.video-js').style.display = 'none';
    const iframe = document.getElementById('web-player');
    iframe.style.display = 'block';
    iframe.src = currentUrl;
    
    // Hide Error Message if it was shown
    document.getElementById('vid-error').style.display = 'none';
});

function openPlayer(d) {
    document.getElementById('player-ui').classList.add('active');
    document.getElementById('p-title').innerText = d.title;
    
    const qBox = document.getElementById('q-btns');
    qBox.innerHTML = "";

    if(d.streams && d.streams.length > 0) {
        tryPlay(d.streams[0].url);

        d.streams.forEach((s, i) => {
            let b = document.createElement('div');
            b.className = i===0 ? 'btn-q active' : 'btn-q';
            b.innerText = s.lbl;
            b.onclick = () => {
                document.querySelectorAll('.btn-q').forEach(x=>x.classList.remove('active'));
                b.classList.add('active');
                tryPlay(s.url);
            }
            qBox.appendChild(b);
        });
    }

    clearInterval(viewInt);
    const min = parseInt(d.minViews) || 1000;
    const max = parseInt(d.maxViews) || 2000;
    updateView(min, max);
    viewInt = setInterval(() => updateView(min, max), 3000);
}

function tryPlay(url) {
    currentUrl = url;
    const vjsTech = document.querySelector('.video-js');
    const iframe = document.getElementById('web-player');
    
    // Reset
    player.error(null);
    document.getElementById('vid-error').style.display = 'none';

    // 1. Detect if URL is definitely NOT a video file (e.g. .html, .php, or just domain)
    const isVideoFile = url.includes('.m3u8') || url.includes('.mp4') || url.includes('.mkv');
    
    if(!isVideoFile) {
        // Direct Iframe Mode
        vjsTech.style.display = 'none';
        iframe.style.display = 'block';
        iframe.src = url;
    } else {
        // Try VideoJS Mode
        iframe.style.display = 'none';
        vjsTech.style.display = 'block';
        player.src({ src: url, type: 'application/x-mpegURL' });
        player.play().catch(e => console.log("Autoplay blocked"));
    }
}

function updateView(min, max) {
    const v = Math.floor(Math.random() * (max - min + 1) + min);
    document.getElementById('view-cnt').innerText = v.toLocaleString();
}

function closePlayer() {
    player.pause();
    document.getElementById('web-player').src = "";
    document.getElementById('player-ui').classList.remove('active');
    clearInterval(viewInt);
}

// --- 6. NOTIFICATIONS (1 Hour) ---
function toggleNotif() {
    document.getElementById('n-menu').classList.toggle('active');
    document.getElementById('n-badge').style.display = 'none';
}

db.collection("notifications").orderBy("time", "desc").onSnapshot(s => {
    const list = document.getElementById('n-list');
    list.innerHTML = "";
    let count = 0;
    const now = Date.now();
    const limit = 3600000; 

    s.forEach(d => {
        const data = d.data();
        if(now - data.time < limit) {
            count++;
            const min = Math.floor((now - data.time)/60000);
            list.innerHTML += `
                <div class="n-item">
                    <h4>${data.title}</h4>
                    <p>${data.msg}</p>
                    <span>${min} mins ago</span>
                </div>`;
        }
    });

    if(count === 0) list.innerHTML = '<div style="padding:20px;text-align:center;color:gray;">No alerts</div>';
    if(count > 0) {
        const b = document.getElementById('n-badge');
        b.style.display = 'block';
        b.innerText = count;
    }
});