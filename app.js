// CONFIG
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

// --- 1. SEARCH FIX ---
function toggleSearch() {
    document.getElementById('search-bar').classList.toggle('open');
    if(document.getElementById('search-bar').classList.contains('open')) {
        document.getElementById('search-inp').focus();
    }
}
document.getElementById('search-inp').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    document.querySelectorAll('.card').forEach(c => {
        c.style.display = c.innerText.toLowerCase().includes(val) ? 'block' : 'none';
    });
});

// --- 2. DYNAMIC ISLAND (BOUNCE IN/OUT) ---
const notifSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
let islandUrl = "";

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
    document.getElementById('di-img').src = d.img || 'https://via.placeholder.com/50';
    islandUrl = d.link;

    // BOUNCE IN
    el.classList.add('active');
    notifSound.play().catch(()=>{});

    // BOUNCE OUT AFTER 6s
    setTimeout(() => {
        el.classList.remove('active');
    }, 6000);
}

function expandIsland() {
    if(islandUrl) window.location.href = islandUrl;
}

// --- 3. WHATSAPP TOAST (25 Min) ---
function showWa() {
    const t = document.getElementById('wa-popup');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 5000);
}
setInterval(showWa, 1500000); // 25 Min
setTimeout(showWa, 15000);    // First run

// --- 4. DATA RENDER ---
let allData = [];
let curCat = 'All';

// Categories
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
    document.getElementById('grid-head').innerText = c + " Matches";
    render();
}

// Matches
db.collection("matches").orderBy("time", "desc").onSnapshot(s => {
    allData = [];
    s.forEach(doc => allData.push(doc.data()));
    render();
});

function render() {
    const g = document.getElementById('grid');
    g.innerHTML = "";
    const filtered = curCat === 'All' ? allData : allData.filter(x => x.category === curCat);
    
    if(filtered.length === 0) { g.innerHTML = '<p style="padding:20px; color:gray;">No matches found.</p>'; return; }

    filtered.forEach(d => {
        const div = document.createElement('div');
        div.className = 'card';
        div.onclick = () => openPlayer(d);
        div.innerHTML = `
            <img src="${d.poster}" class="poster" onerror="this.src='https://via.placeholder.com/300x160'">
            <div class="c-content">
                <div class="c-title">${d.title}</div>
                <div class="c-ft">
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
    s.forEach(doc => {
        const d = doc.data();
        const div = document.createElement('div');
        div.className = 'slide';
        div.style.backgroundImage = `url('${d.img}')`;
        if(d.link) div.onclick = () => openPlayer({title:d.title, streams:[{lbl:'HD', url:d.link}]});
        div.innerHTML = `<div class="slide-overlay"><span class="slide-badge">HOT</span><div class="slide-title">${d.title}</div></div>`;
        slider.appendChild(div);
    });
});

// --- 5. PLAYER ---
var player = videojs('v-player', { fluid: true, html5: { hls: { overrideNative: true } } });
let viewInt;

function openPlayer(d) {
    document.getElementById('player-ui').classList.add('active');
    document.getElementById('p-title').innerText = d.title;
    const qBox = document.getElementById('q-btns');
    qBox.innerHTML = "";

    if(d.streams && d.streams.length > 0) {
        playLink(d.streams[0].url);
        d.streams.forEach((s, i) => {
            let b = document.createElement('div');
            b.className = i===0 ? 'btn-q active' : 'btn-q';
            b.innerText = s.lbl;
            b.onclick = () => {
                document.querySelectorAll('.btn-q').forEach(x=>x.classList.remove('active'));
                b.classList.add('active');
                playLink(s.url);
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

function updateView(min, max) {
    const v = Math.floor(Math.random() * (max - min + 1) + min);
    document.getElementById('view-cnt').innerText = v.toLocaleString();
}

function playLink(url) {
    player.src({ src: url, type: 'application/x-mpegURL' });
    player.play().catch(()=>{});
}

function closePlayer() {
    player.pause();
    document.getElementById('player-ui').classList.remove('active');
    clearInterval(viewInt);
}